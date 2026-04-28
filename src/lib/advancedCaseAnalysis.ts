import type { SessionRecord } from '../types/mindpulseExport'
import { EMOTION_KEYS } from './correlationAdvanced'
import { pearson } from './caseAnalytics'

/** Row/column keys treated as emotional side in windowed correlation UI (expression + derived scalars). */
export const WINDOWED_EMOTION_FEATURE_KEYS = new Set<string>([
  'valence',
  'negativeScore',
  'entropy',
  'intensity',
  ...EMOTION_KEYS,
])

type NumMap = Record<string, number>

type ResampledPoint = {
  t: number
  emotions: NumMap
  physical: NumMap
  dominantEmotion: string
  emotionalState: 'Neutral' | 'Negative' | 'Positive'
  physicalState: 'Focused' | 'Stressed' | 'Recovery'
  negativeScore: number
  valence: number
  entropy: number
  intensity: number
}

type TransitionMatrix = {
  states: string[]
  counts: number[][]
  probs: number[][]
}

type RankedPair = {
  label: string
  bestLagMs: number
  bestR: number | null
  pValue: number | null
  confidence: 'Low' | 'Medium' | 'High'
}

type FeatureImportance = {
  feature: string
  weight: number
}

type EventNarrative = {
  type: string
  tMs: number
  before: string
  during: string
  after: string
  lagMs: number
  confidence: 'Low' | 'Medium' | 'High'
}

export type AdvancedCaseAnalysis = {
  stepMs: number
  points: number
  dataQuality: {
    score: number
    reliable: number
    total: number
    excludedSignals: string[]
  }
  adequacy: {
    enoughSamples: boolean
    emotionDynamicRange: boolean
    physiologyDynamicRange: boolean
    message: string
  }
  insightHeadline: string
  finalInsight: {
    primary_finding: string
    supporting_points: string[]
    confidence: 'Low' | 'Moderate' | 'High'
    validity_flags: {
      emotion_variance: 'Low' | 'Adequate'
      physio_variance: 'Low' | 'Adequate'
      sensor_quality: number
    }
  }
  mlInference: {
    modelQuality: 'Weak' | 'Moderate' | 'Strong'
    fitR2: number | null
    stressProbability: number | null
    decouplingIndex: number | null
    topDrivers: string[]
    narrative: string
  }
  temporalCausality: {
    topRelationships: RankedPair[]
    directionality: string
  }
  stateDynamics: {
    dominantPhysical: string
    physicalPersistencePct: number
    dominantEmotional: string
    emotionalPersistencePct: number
    interpretation: string
  }
  executiveFindings: string[]
  evidenceFindings: string[]
  realityCheck: string[]
  lagged: RankedPair[]
  topRelationships: RankedPair[]
  lowSignificanceCount: number
  granger: Array<{ direction: string; fScore: number | null }>
  physicalTransitions: TransitionMatrix
  emotionalTransitions: TransitionMatrix
  pearsonWindow: { keys: string[]; values: (number | null)[][] }
  spearmanWindow: { keys: string[]; values: (number | null)[][] }
  importance: FeatureImportance[]
  mutualInfoBits: number | null
  pcaAlignmentR: number | null
  interpretationLayer: string[]
  events: EventNarrative[]
}

export function analyzeCaseDeep(session: SessionRecord, stepMs = 500): AdvancedCaseAnalysis {
  const points = buildResampledPoints(session, stepMs)
  const dataQuality = computeDataQuality(session)
  const adequacy = computeAdequacy(points)
  const realityCheck = buildRealityCheck(points)
  const lagged = computeLagged(points, stepMs)
  const topRelationships = lagged.filter((x) => x.bestR != null && Math.abs(x.bestR) >= 0.25).slice(0, 5)
  const lowSignificanceCount = lagged.length - topRelationships.length
  const granger = computeGranger(points)
  const insightHeadline = buildInsightHeadline(points, adequacy, topRelationships, lagged)
  const finalInsight = buildFinalInsight(points, adequacy, dataQuality, topRelationships)
  const mlInference = computeMlInference(points)
  const temporalCausality = {
    topRelationships: topRelationships.slice(0, 2),
    directionality: grangerLabelPreview(points),
  }
  const stateDynamics = buildStateDynamics(points)
  const executiveFindings = buildExecutiveFindings(points, adequacy, dataQuality, topRelationships, mlInference)
  const evidenceFindings = buildEvidenceFindings(topRelationships, temporalCausality.directionality)
  const physicalTransitions = buildTransition(
    ['Focused', 'Stressed', 'Recovery'],
    points.map((p) => p.physicalState),
  )
  const emotionalTransitions = buildTransition(
    ['Neutral', 'Negative', 'Positive'],
    points.map((p) => p.emotionalState),
  )
  const windowed = computeWindowedCorr(points, stepMs)
  const importance = computeSurrogateImportance(points)
  const mutualInfoBits = computeMutualInfo(
    points.map((p) => p.negativeScore),
    points.map((p) => p.physical.hrvRmssd ?? NaN),
  )
  const pcaAlignmentR = computePcaAlignment(points)
  const interpretationLayer = buildInterpretationLayer(mutualInfoBits, pcaAlignmentR, granger)
  const events = detectEvents(points, stepMs)

  return {
    stepMs,
    points: points.length,
    dataQuality,
    adequacy,
    insightHeadline,
    finalInsight,
    mlInference,
    temporalCausality,
    stateDynamics,
    executiveFindings,
    evidenceFindings,
    realityCheck,
    lagged,
    topRelationships,
    lowSignificanceCount,
    granger,
    physicalTransitions,
    emotionalTransitions,
    pearsonWindow: windowed.pearson,
    spearmanWindow: windowed.spearman,
    importance,
    mutualInfoBits,
    pcaAlignmentR,
    interpretationLayer,
    events,
  }
}

function buildInterpretationLayer(
  mutualInfoBits: number | null,
  pcaAlignmentR: number | null,
  granger: Array<{ direction: string; fScore: number | null }>,
) {
  const out: string[] = []
  if (mutualInfoBits == null) {
    out.push('Physical–emotional MI (negative score vs RMSSD): n/a (too few pairs).')
  } else if (mutualInfoBits < 0.03) {
    out.push(`Physical–emotional MI (negative score vs RMSSD): ${mutualInfoBits.toFixed(3)} bits (low).`)
  } else if (mutualInfoBits < 0.1) {
    out.push(`Physical–emotional MI (negative score vs RMSSD): ${mutualInfoBits.toFixed(3)} bits (medium).`)
  } else {
    out.push(`Physical–emotional MI (negative score vs RMSSD): ${mutualInfoBits.toFixed(3)} bits (higher).`)
  }

  if (pcaAlignmentR == null) {
    out.push('Emotional vs physical PCA alignment: n/a.')
  } else {
    const ar = Math.abs(pcaAlignmentR)
    if (ar < 0.15) {
      out.push(`Emotional vs physical PCA alignment: r=${pcaAlignmentR.toFixed(3)} (weak).`)
    } else if (ar < 0.35) {
      out.push(`Emotional vs physical PCA alignment: r=${pcaAlignmentR.toFixed(3)} (moderate).`)
    } else {
      out.push(`Emotional vs physical PCA alignment: r=${pcaAlignmentR.toFixed(3)} (stronger).`)
    }
  }

  const best = granger
    .filter((g) => g.fScore != null)
    .sort((a, b) => (b.fScore ?? -Infinity) - (a.fScore ?? -Infinity))[0]
  if (!best || best.fScore == null || best.fScore <= 0) {
    out.push('Granger preview (physical–emotional direction): no clear direction.')
  } else if (best.fScore < 1.5) {
    out.push(`Granger preview (physical–emotional direction): weak (F=${best.fScore.toFixed(2)}).`)
  } else {
    out.push(`Granger preview (physical–emotional direction): ${best.direction} (F=${best.fScore.toFixed(2)}).`)
  }
  return out
}

function buildFinalInsight(
  points: ResampledPoint[],
  adequacy: AdvancedCaseAnalysis['adequacy'],
  dataQuality: AdvancedCaseAnalysis['dataQuality'],
  topRelationships: RankedPair[],
): AdvancedCaseAnalysis['finalInsight'] {
  const stressedPct = points.length
    ? (100 * points.filter((p) => p.physicalState === 'Stressed').length) / points.length
    : 0
  const neutralPct = points.length ? 100 * avg(points.map((p) => p.emotions.neutral ?? 0)) : 0
  const lag = topRelationships[0]
  return {
    primary_finding: isStressEmotionDecoupling(points)
      ? 'Physical stress state dominates while emotional signals stay mostly neutral (possible decoupling).'
      : 'Some physical–emotional stress linkage; strength limited.',
    supporting_points: [
      `Stressed physical-state share ~${stressedPct.toFixed(1)}%.`,
      `Neutral emotional expression mean ~${neutralPct.toFixed(1)}%.`,
      lag
        ? `Best lag: ${lag.label} (${Math.abs(lag.bestLagMs) / 1000}s).`
        : 'No strong lagged pair after filters.',
    ],
    confidence: mapConfidence(adequacy, topRelationships[0]?.confidence),
    validity_flags: {
      emotion_variance: adequacy.emotionDynamicRange ? 'Adequate' : 'Low',
      physio_variance: adequacy.physiologyDynamicRange ? 'Adequate' : 'Low',
      sensor_quality: Math.round(dataQuality.score),
    },
  }
}

function mapConfidence(
  adequacy: AdvancedCaseAnalysis['adequacy'],
  topConfidence?: 'Low' | 'Medium' | 'High',
): 'Low' | 'Moderate' | 'High' {
  if (!adequacy.enoughSamples) return 'Low'
  if (!adequacy.emotionDynamicRange || !adequacy.physiologyDynamicRange) return 'Low'
  if (topConfidence === 'High') return 'High'
  if (topConfidence === 'Medium') return 'Moderate'
  return 'Low'
}

function buildStateDynamics(points: ResampledPoint[]): AdvancedCaseAnalysis['stateDynamics'] {
  const physCounts = countStates(points.map((p) => p.physicalState))
  const emoCounts = countStates(points.map((p) => p.emotionalState))
  const [dominantPhysical, physN] = topCount(physCounts)
  const [dominantEmotional, emoN] = topCount(emoCounts)
  const total = Math.max(1, points.length)
  const physicalPersistencePct = (100 * physN) / total
  const emotionalPersistencePct = (100 * emoN) / total
  return {
    dominantPhysical,
    physicalPersistencePct,
    dominantEmotional,
    emotionalPersistencePct,
    interpretation:
      dominantPhysical === 'Stressed' && dominantEmotional === 'Neutral'
        ? 'Stressed physical state with neutral emotional mix.'
        : 'Mixed physical and emotional states.',
  }
}

function countStates(items: string[]) {
  const m = new Map<string, number>()
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}

function topCount(m: Map<string, number>): [string, number] {
  let best = 'Unknown'
  let n = 0
  for (const [k, v] of m.entries()) {
    if (v > n) {
      best = k
      n = v
    }
  }
  return [best, n]
}

function computeAdequacy(points: ResampledPoint[]) {
  const enoughSamples = points.length >= 20
  const val = points.map((p) => p.valence)
  const hrv = points.map((p) => p.physical.hrvRmssd).filter((x): x is number => Number.isFinite(x))
  const valRange = Math.max(...val) - Math.min(...val)
  const hrvRange = hrv.length ? Math.max(...hrv) - Math.min(...hrv) : 0
  const emotionDynamicRange = valRange >= 0.08
  const physiologyDynamicRange = hrvRange >= 8
  let message = 'Signal range OK for lag/events.'
  if (!enoughSamples) message = 'Few samples — treat metrics as rough.'
  else if (!emotionDynamicRange || !physiologyDynamicRange) {
    message = 'Low range on emotional or physical parameters — prefer events over global r.'
  }
  return { enoughSamples, emotionDynamicRange, physiologyDynamicRange, message }
}

function buildInsightHeadline(
  points: ResampledPoint[],
  adequacy: AdvancedCaseAnalysis['adequacy'],
  top: RankedPair[],
  lagged: RankedPair[],
) {
  if (isStressEmotionDecoupling(points)) {
    return 'Stressed physical signals vs neutral emotional signals (possible decoupling).'
  }
  if (!adequacy.enoughSamples) return 'Too few samples for stable coupling.'
  if (!adequacy.emotionDynamicRange || !adequacy.physiologyDynamicRange) {
    return 'Low signal range — use events/transitions.'
  }
  const best = top[0] ?? lagged.find((x) => x.bestR != null)
  if (!best || best.bestR == null) {
    return 'No strong physical–emotional pair in lag search.'
  }
  const lead =
    best.bestLagMs > 0
      ? `first series leads by ${Math.abs(best.bestLagMs)} ms`
      : best.bestLagMs < 0
        ? `second series leads by ${Math.abs(best.bestLagMs)} ms`
        : 'strongest at zero lag'
  return `Top: ${best.label} · r=${best.bestR.toFixed(3)} · ${lead}.`
}

function buildExecutiveFindings(
  points: ResampledPoint[],
  adequacy: AdvancedCaseAnalysis['adequacy'],
  dataQuality: AdvancedCaseAnalysis['dataQuality'],
  topRelationships: RankedPair[],
  mlInference: AdvancedCaseAnalysis['mlInference'],
) {
  const stressedPct = points.length
    ? (100 * points.filter((p) => p.physicalState === 'Stressed').length) / points.length
    : 0
  const meanNeutral = points.length ? avg(points.map((p) => p.emotions.neutral ?? 0)) : 0
  const strongest = topRelationships[0]
  return [
    `Stressed physical-state ${stressedPct.toFixed(1)}%; neutral emotional expression mean ${meanNeutral.toFixed(2)}.`,
    strongest && strongest.bestR != null
      ? `Best lag: ${strongest.label} @ ${strongest.bestLagMs} ms · r=${strongest.bestR.toFixed(3)} (${strongest.confidence}).`
      : 'No strong lag pair.',
    `Sensor quality ${dataQuality.score.toFixed(0)}/100 (${dataQuality.reliable}/${dataQuality.total} OK).`,
    `Seq. model: ${mlInference.modelQuality}${mlInference.fitR2 != null ? ` · R² ${mlInference.fitR2.toFixed(3)}` : ''}.`,
    adequacy.message,
  ]
}

function computeMlInference(points: ResampledPoint[]): AdvancedCaseAnalysis['mlInference'] {
  const sequenceData = buildSequenceFeatureDataset(points)
  const rows = sequenceData.rows
  const y = sequenceData.y
  const featureNames = sequenceData.featureNames
  if (rows.length < 24 || featureNames.length < 4) {
    return {
      modelQuality: 'Weak',
      fitR2: null,
      stressProbability: null,
      decouplingIndex: null,
      topDrivers: [],
      narrative: 'Seq. model: skipped (too few windows).',
    }
  }

  const split = Math.max(16, Math.floor(rows.length * 0.7))
  const trainX = rows.slice(0, split)
  const testX = rows.slice(split)
  const trainY = y.slice(0, split)
  const testY = y.slice(split)
  if (testX.length < 8) {
    return {
      modelQuality: 'Weak',
      fitR2: null,
      stressProbability: null,
      decouplingIndex: null,
      topDrivers: [],
      narrative: 'Seq. model: skipped (short holdout).',
    }
  }

  const scaler = fitStandardizer(trainX)
  const trainZ = transformWithStandardizer(trainX, scaler)
  const testZ = transformWithStandardizer(testX, scaler)
  const yMean = avg(trainY)
  const ySd = Math.sqrt(avg(trainY.map((v) => (v - yMean) ** 2))) || 1
  const trainYz = trainY.map((v) => (v - yMean) / ySd)
  const beta = ridgeBeta(trainZ.map((r) => [1, ...r]), trainYz, 1.2)
  if (!beta) {
    return {
      modelQuality: 'Weak',
      fitR2: null,
      stressProbability: null,
      decouplingIndex: null,
      topDrivers: [],
      narrative: 'Seq. model: no fit.',
    }
  }
  const predTestZ = testZ.map((r) => dot([1, ...r], beta))
  const predTest = predTestZ.map((v) => v * ySd + yMean)
  const fitR2 = r2(testY, predTest)

  const coef = beta.slice(1)
  const topDrivers = featureNames
    .map((f, i) => ({ f, w: Math.abs(coef[i] ?? 0) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => prettyMetricName(x.f))

  const latest = rows[rows.length - 1]!
  const zHR = safeZ(latest[featureNames.indexOf('heartRate_t0')] ?? NaN, scaler, featureNames.indexOf('heartRate_t0'))
  const zHRV = safeZ(latest[featureNames.indexOf('hrvRmssd_t0')] ?? NaN, scaler, featureNames.indexOf('hrvRmssd_t0'))
  const zFocus = safeZ(
    latest[featureNames.indexOf('focusIndex_t0')] ?? NaN,
    scaler,
    featureNames.indexOf('focusIndex_t0'),
  )
  const stressScore = 0.45 * zHR + 0.4 * -zHRV + 0.15 * -zFocus
  const stressProbability = sigmoid(stressScore)

  const neutralMean = avg(points.map((p) => p.emotions.neutral ?? 0))
  const decouplingIndex = Math.max(0, Math.min(1, neutralMean * (1 - Math.max(0, fitR2) / 0.35)))
  const modelQuality: 'Weak' | 'Moderate' | 'Strong' =
    fitR2 >= 0.22 ? 'Strong' : fitR2 >= 0.08 ? 'Moderate' : 'Weak'
  const narrative =
    modelQuality === 'Strong'
      ? `Seq. model R²=${fitR2.toFixed(3)} (${modelQuality}); drivers: ${topDrivers.join(', ')}.`
      : modelQuality === 'Moderate'
        ? `Seq. model R²=${fitR2.toFixed(3)} (${modelQuality}); drivers: ${topDrivers.join(', ')}.`
        : `Seq. model R²=${fitR2.toFixed(3)} (${modelQuality}); weak physical→emotional map.`

  return {
    modelQuality,
    fitR2,
    stressProbability,
    decouplingIndex,
    topDrivers,
    narrative,
  }
}

function buildSequenceFeatureDataset(points: ResampledPoint[]) {
  const base = [
    'hrvRmssd',
    'heartRate',
    'focusIndex',
    'spo2',
    'systolic',
    'diastolic',
    'autonomicConfidence',
    'caloriesActive',
  ]
  const available = base.filter((f) => points.some((p) => Number.isFinite(p.physical[f] ?? NaN)))
  const rowDefs: Array<{ name: string; at: (i: number) => number }> = []
  for (const f of available) {
    rowDefs.push({ name: `${f}_t0`, at: (i) => points[i]!.physical[f] ?? NaN })
    rowDefs.push({ name: `${f}_lag1`, at: (i) => points[i - 1]!.physical[f] ?? NaN })
    rowDefs.push({
      name: `${f}_roll3`,
      at: (i) => avgNum([points[i]!.physical[f], points[i - 1]!.physical[f], points[i - 2]!.physical[f]]),
    })
    rowDefs.push({
      name: `${f}_delta`,
      at: (i) => {
        const now = points[i]!.physical[f] ?? NaN
        const prev = points[i - 1]!.physical[f] ?? NaN
        return Number.isFinite(now) && Number.isFinite(prev) ? now - prev : NaN
      },
    })
  }

  const rows: number[][] = []
  const y: number[] = []
  for (let i = 2; i < points.length; i++) {
    const row = rowDefs.map((d) => d.at(i))
    if (!row.every((v) => Number.isFinite(v))) continue
    const target = points[i]!.negativeScore
    if (!Number.isFinite(target)) continue
    rows.push(row)
    y.push(target)
  }
  return { rows, y, featureNames: rowDefs.map((d) => d.name) }
}

function buildEvidenceFindings(topRelationships: RankedPair[], grangerPreview: string) {
  const items = topRelationships.slice(0, 3).map((x) => {
    const pText = x.pValue != null ? `, p=${x.pValue.toFixed(3)}` : ''
    return `${x.label}: lag ${x.bestLagMs} ms, r=${x.bestR?.toFixed(3) ?? '—'}${pText}, confidence ${x.confidence}.`
  })
  items.push(grangerPreview)
  return items
}

function grangerLabelPreview(points: ResampledPoint[]) {
  const g = computeGranger(points)
  const best = g.find((x) => x.fScore != null && x.fScore > 0)
  if (!best || best.fScore == null) return 'Direction: unclear.'
  return `${best.direction} (F=${best.fScore.toFixed(2)}).`
}

function isStressEmotionDecoupling(points: ResampledPoint[]) {
  if (!points.length) return false
  const stressedPct = (100 * points.filter((p) => p.physicalState === 'Stressed').length) / points.length
  const meanNeutral = avg(points.map((p) => p.emotions.neutral ?? 0))
  const negSeries = points.map((p) => p.negativeScore)
  const negRange = Math.max(...negSeries) - Math.min(...negSeries)
  return stressedPct >= 70 && meanNeutral >= 0.8 && negRange < 0.2
}

function computeDataQuality(session: SessionRecord) {
  const series = session.physicalTimeSeries ?? []
  let total = 0
  let reliable = 0
  const excluded = new Set<string>()
  for (const row of series) {
    for (const [k, v] of Object.entries(row)) {
      if (k === 'sessionTimeMs' || k === 'caseId' || k === 'autonomicState') continue
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      total++
      if (isPhysicalValueReliable(k, v)) reliable++
      else excluded.add(k)
    }
  }
  const score = total > 0 ? (100 * reliable) / total : 0
  return { score, reliable, total, excludedSignals: [...excluded] }
}

function buildResampledPoints(session: SessionRecord, stepMs: number): ResampledPoint[] {
  const emotion = [...(session.emotionTimeSeries ?? [])].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs)
  const physical = [...(session.physicalTimeSeries ?? [])].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs)
  if (!emotion.length || !physical.length) return []

  const physicalKeys = new Set<string>()
  for (const p of physical) {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'sessionTimeMs' || k === 'caseId') continue
      if (typeof v === 'number' && Number.isFinite(v)) physicalKeys.add(k)
    }
  }
  const phys = [...physicalKeys]
  const maxT = Math.max(
    emotion[emotion.length - 1]!.sessionTimeMs,
    physical[physical.length - 1]!.sessionTimeMs,
  )

  const out: ResampledPoint[] = []
  for (let t = 0; t <= maxT; t += stepMs) {
    const em = interpEmotion(emotion, t)
    const ph = interpPhysical(physical, phys, t)
    if (!em || !ph) continue
    const dominantEmotion = EMOTION_KEYS.reduce((best, k) => (em[k] > em[best] ? k : best), 'neutral')
    const negativeScore = em.anger + em.fear + em.disgust + em.sadness
    const positiveScore = em.happy + 0.5 * em.surprise
    const valence = positiveScore - negativeScore
    const intensity = Math.max(...EMOTION_KEYS.map((k) => em[k]))
    const entropy = shannon(EMOTION_KEYS.map((k) => em[k]))
    const emotionalState =
      dominantEmotion === 'neutral' ? 'Neutral' : negativeScore >= positiveScore ? 'Negative' : 'Positive'
    const physicalState = inferPhysicalState(ph, nearestPhysicalState(physical, t))
    out.push({
      t,
      emotions: em,
      physical: ph,
      dominantEmotion,
      emotionalState,
      physicalState,
      negativeScore,
      valence,
      entropy,
      intensity,
    })
  }
  return out
}

function interpEmotion(
  points: NonNullable<SessionRecord['emotionTimeSeries']>,
  t: number,
): NumMap | null {
  const a = floorAt(points, t)
  const b = ceilAt(points, t)
  if (!a && !b) return null
  if (!a) return toEmotionMap(b!)
  if (!b) return toEmotionMap(a)
  if (a.sessionTimeMs === b.sessionTimeMs) return toEmotionMap(a)
  const w = (t - a.sessionTimeMs) / (b.sessionTimeMs - a.sessionTimeMs)
  const out: NumMap = {}
  for (const k of EMOTION_KEYS) out[k] = lerp(a[k], b[k], w)
  return out
}

function interpPhysical(
  points: NonNullable<SessionRecord['physicalTimeSeries']>,
  keys: string[],
  t: number,
): NumMap | null {
  const a = floorAt(points, t)
  const b = ceilAt(points, t)
  if (!a && !b) return null
  const out: NumMap = {}
  for (const k of keys) {
    const avRaw = a && typeof a[k] === 'number' ? (a[k] as number) : NaN
    const bvRaw = b && typeof b[k] === 'number' ? (b[k] as number) : NaN
    const av = Number.isFinite(avRaw) && isPhysicalValueReliable(k, avRaw) ? avRaw : NaN
    const bv = Number.isFinite(bvRaw) && isPhysicalValueReliable(k, bvRaw) ? bvRaw : NaN
    if (Number.isFinite(av) && Number.isFinite(bv) && a && b && a.sessionTimeMs !== b.sessionTimeMs) {
      const w = (t - a.sessionTimeMs) / (b.sessionTimeMs - a.sessionTimeMs)
      out[k] = lerp(av, bv, w)
    } else if (Number.isFinite(av)) out[k] = av
    else if (Number.isFinite(bv)) out[k] = bv
  }
  for (const k of keys) {
    if (!(k in out)) out[k] = NaN
  }
  return Object.keys(out).length ? out : null
}

function isPhysicalValueReliable(key: string, value: number) {
  const k = key.toLowerCase()
  /* Slightly wider bands so pilot / wearable edge values still join resampling and windowed corr. */
  if (k.includes('spo2')) return value >= 85 && value <= 100
  if (k.includes('heartrate') || k === 'hr') return value >= 30 && value <= 240
  if (k.includes('hrv') || k.includes('rmssd')) return value >= 5 && value <= 250
  if (k.includes('focus')) return value >= 0 && value <= 100
  if (k.includes('systolic')) return value >= 70 && value <= 220
  if (k.includes('diastolic')) return value >= 40 && value <= 140
  if (k.includes('bodytemp') || k.includes('temp')) return value >= 32 && value <= 42
  return Number.isFinite(value)
}

function toEmotionMap(e: NonNullable<SessionRecord['emotionTimeSeries']>[number]): NumMap {
  const out: NumMap = {}
  for (const k of EMOTION_KEYS) out[k] = e[k]
  return out
}

function floorAt<T extends { sessionTimeMs: number }>(arr: T[], t: number): T | null {
  let best: T | null = null
  for (const x of arr) {
    if (x.sessionTimeMs <= t) best = x
    else break
  }
  return best
}

function ceilAt<T extends { sessionTimeMs: number }>(arr: T[], t: number): T | null {
  for (const x of arr) if (x.sessionTimeMs >= t) return x
  return null
}

function lerp(a: number, b: number, w: number) {
  return a + (b - a) * w
}

function shannon(ps: number[]) {
  let s = 0
  for (const p0 of ps) {
    const p = Math.max(1e-9, p0)
    s += -p * Math.log2(p)
  }
  return s
}

function nearestPhysicalState(points: NonNullable<SessionRecord['physicalTimeSeries']>, t: number): string {
  let best = points[0]!
  let bd = Math.abs(points[0]!.sessionTimeMs - t)
  for (const p of points) {
    const d = Math.abs(p.sessionTimeMs - t)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return String(best.autonomicState ?? '')
}

function inferPhysicalState(physical: NumMap, sourceLabel: string): 'Focused' | 'Stressed' | 'Recovery' {
  const label = sourceLabel.toLowerCase()
  if (label.includes('stressed')) return 'Stressed'
  if (label.includes('focused')) return 'Focused'
  const hrv = physical.hrvRmssd ?? NaN
  if (Number.isFinite(hrv) && hrv <= 30) return 'Stressed'
  if (Number.isFinite(hrv) && hrv >= 50) return 'Focused'
  return 'Recovery'
}

function buildRealityCheck(points: ResampledPoint[]) {
  if (!points.length) return ['No aligned points.']
  const neutral = points.map((p) => p.emotions.neutral)
  const meanNeutral = avg(neutral)
  const spikeNeg = Math.max(...points.map((p) => p.negativeScore))
  const hrv = points.map((p) => p.physical.hrvRmssd).filter((x): x is number => Number.isFinite(x))
  const hrvRange = hrv.length ? `${Math.min(...hrv).toFixed(1)}–${Math.max(...hrv).toFixed(1)} ms` : 'n/a'
  const stressedPct = (100 * points.filter((p) => p.physicalState === 'Stressed').length) / points.length
  return [
    `Neutral mean ${meanNeutral.toFixed(3)}; neg. score max ${spikeNeg.toFixed(3)}.`,
    `HRV ${hrvRange}; stressed ${stressedPct.toFixed(1)}%.`,
    'Prefer lag/events over zero-lag r alone.',
  ]
}

function computeLagged(points: ResampledPoint[], stepMs: number): RankedPair[] {
  const pairs: Array<{ a: number[]; b: number[]; label: string }> = []
  const emotionSeries: Array<{ label: string; values: number[] }> = [
    { label: 'neutral', values: points.map((p) => p.emotions.neutral) },
    { label: 'happy', values: points.map((p) => p.emotions.happy) },
    { label: 'sadness', values: points.map((p) => p.emotions.sadness) },
    { label: 'anger', values: points.map((p) => p.emotions.anger) },
    { label: 'fear', values: points.map((p) => p.emotions.fear) },
    { label: 'disgust', values: points.map((p) => p.emotions.disgust) },
    { label: 'surprise', values: points.map((p) => p.emotions.surprise) },
    { label: 'negative emotion score', values: points.map((p) => p.negativeScore) },
    { label: 'valence', values: points.map((p) => p.valence) },
  ].filter((x) => varianceFinite(x.values) >= 0.002)

  const physicalKeys = Array.from(
    new Set(points.flatMap((p) => Object.keys(p.physical))),
  ).filter((k) => varianceFinite(points.map((p) => p.physical[k] ?? NaN)) >= 4)

  for (const pk of physicalKeys) {
    const phys = points.map((p) => p.physical[pk] ?? NaN)
    for (const emo of emotionSeries) {
      pairs.push({ a: phys, b: emo.values, label: `${pk} → ${emo.label}` })
    }
  }
  const maxLagSteps = Math.max(1, Math.round(10000 / stepMs))
  return pairs
    .map((p) => {
    let bestR: number | null = null
    let bestLag = 0
    for (let lag = -maxLagSteps; lag <= maxLagSteps; lag++) {
      const { x, y } = lagAlign(p.a, p.b, lag)
      const r = pearson(x, y)
      if (r == null) continue
      if (bestR == null || Math.abs(r) > Math.abs(bestR)) {
        bestR = r
        bestLag = lag
      }
    }
    return {
      label: p.label,
      bestLagMs: bestLag * stepMs,
      bestR,
      pValue: approxPValue(bestR, points.length),
      confidence: confidenceLabel(bestR, points.length),
    }
    })
    .filter((x) => x.bestR != null)
    .sort((a, b) => Math.abs((b.bestR as number) || 0) - Math.abs((a.bestR as number) || 0))
}

function varianceFinite(xs: number[]) {
  const f = xs.filter((x): x is number => Number.isFinite(x))
  if (f.length < 4) return 0
  const m = avg(f)
  return avg(f.map((x) => (x - m) ** 2))
}

function confidenceLabel(r: number | null, n: number): 'Low' | 'Medium' | 'High' {
  if (r == null || n < 20) return 'Low'
  const ar = Math.abs(r)
  if (ar >= 0.5 && n >= 60) return 'High'
  if (ar >= 0.3 && n >= 35) return 'Medium'
  return 'Low'
}

function approxPValue(r: number | null, n: number): number | null {
  if (r == null || n < 8 || Math.abs(r) >= 0.999999) return null
  const z = 0.5 * Math.log((1 + r) / (1 - r)) * Math.sqrt(Math.max(1, n - 3))
  return erfc(Math.abs(z) / Math.SQRT2)
}

function erfc(x: number) {
  return 1 - erf(x)
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax)
  return sign * y
}

function lagAlign(a: number[], b: number[], lag: number) {
  const x: number[] = []
  const y: number[] = []
  if (lag >= 0) {
    for (let i = 0; i < a.length - lag; i++) {
      const av = a[i]!
      const bv = b[i + lag]!
      if (Number.isFinite(av) && Number.isFinite(bv)) {
        x.push(av)
        y.push(bv)
      }
    }
  } else {
    const L = -lag
    for (let i = 0; i < a.length - L; i++) {
      const av = a[i + L]!
      const bv = b[i]!
      if (Number.isFinite(av) && Number.isFinite(bv)) {
        x.push(av)
        y.push(bv)
      }
    }
  }
  return { x, y }
}

function computeGranger(points: ResampledPoint[]) {
  const hrv = points.map((p) => p.physical.hrvRmssd ?? NaN)
  const neg = points.map((p) => p.negativeScore)
  const p = 3
  return [
    { direction: 'HRV predicts negative emotion', fScore: grangerF(hrv, neg, p) },
    { direction: 'Negative emotion predicts HRV', fScore: grangerF(neg, hrv, p) },
  ]
}

function grangerF(x: number[], y: number[], p: number): number | null {
  const rows: { y: number; ry: number[]; rxy: number[] }[] = []
  for (let t = p; t < y.length; t++) {
    const yt = y[t]!
    if (!Number.isFinite(yt)) continue
    const ry: number[] = []
    const rxy: number[] = []
    let ok = true
    for (let k = 1; k <= p; k++) {
      const yk = y[t - k]!
      const xk = x[t - k]!
      if (!Number.isFinite(yk) || !Number.isFinite(xk)) {
        ok = false
        break
      }
      ry.push(yk)
      rxy.push(yk, xk)
    }
    if (ok) rows.push({ y: yt, ry, rxy })
  }
  if (rows.length < 20) return null
  const yv = rows.map((r) => r.y)
  const xr = rows.map((r) => [1, ...r.ry])
  const xf = rows.map((r) => [1, ...r.rxy])
  const sseR = sse(yv, predictOls(xr, yv))
  const sseF = sse(yv, predictOls(xf, yv))
  if (!(sseR > sseF)) return 0
  const n = rows.length
  const df1 = p
  const df2 = n - (2 * p + 1)
  if (df2 <= 0) return null
  return ((sseR - sseF) / df1) / (sseF / df2)
}

function buildTransition(states: string[], seq: string[]): TransitionMatrix {
  const idx = new Map(states.map((s, i) => [s, i]))
  const counts = states.map(() => states.map(() => 0))
  for (let i = 0; i < seq.length - 1; i++) {
    const a = idx.get(seq[i]!)
    const b = idx.get(seq[i + 1]!)
    if (a == null || b == null) continue
    counts[a]![b]!++
  }
  const probs = counts.map((row) => {
    const sum = row.reduce((acc, v) => acc + v, 0)
    return sum === 0 ? row.map(() => 0) : row.map((v) => v / sum)
  })
  return { states, counts, probs }
}

/** Preferred column order for wearable / numeric physical keys (remainder sorted A–Z). */
const WINDOWED_PHYSICAL_KEY_ORDER = [
  'hrvRmssd',
  'heartRate',
  'restingHeartRate',
  'focusIndex',
  'spo2',
  'systolic',
  'diastolic',
  'bodyTempC',
  'autonomicConfidence',
  'caloriesActive',
] as const

function collectPhysicalKeysForWindowedCorr(points: ResampledPoint[]): string[] {
  const u = new Set<string>()
  for (const p of points) {
    for (const k of Object.keys(p.physical)) u.add(k)
  }
  const keys = [...u]
  const rank = (k: string) => {
    const i = (WINDOWED_PHYSICAL_KEY_ORDER as readonly string[]).indexOf(k)
    return i === -1 ? 1000 : i
  }
  return keys.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return a.localeCompare(b)
  })
}

function buildWindowedFeatureOrder(points: ResampledPoint[]): string[] {
  const emotional = ['valence', 'negativeScore', 'entropy', 'intensity', ...EMOTION_KEYS] as const
  const physical = collectPhysicalKeysForWindowedCorr(points)
  return [...emotional, ...physical]
}

function windowMeanForFeature(slice: ResampledPoint[], key: string): number {
  if (key === 'valence') return avg(slice.map((p) => p.valence))
  if (key === 'negativeScore') return avg(slice.map((p) => p.negativeScore))
  if (key === 'entropy') return avg(slice.map((p) => p.entropy))
  if (key === 'intensity') return avg(slice.map((p) => p.intensity))
  if ((EMOTION_KEYS as readonly string[]).includes(key)) {
    return avg(slice.map((p) => p.emotions[key]!))
  }
  return avgNum(slice.map((p) => p.physical[key]))
}

function computeWindowedCorr(points: ResampledPoint[], stepMs: number) {
  const w = Math.max(3, Math.round(3000 / stepMs))
  const featureNames = buildWindowedFeatureOrder(points)
  const nullMatrix = featureNames.map(() => featureNames.map((): number | null => null))
  if (!featureNames.length || points.length < w) {
    return {
      pearson: { keys: featureNames, values: nullMatrix },
      spearman: { keys: featureNames, values: nullMatrix },
    }
  }
  const windows: Record<string, number[]> = Object.fromEntries(featureNames.map((k) => [k, []]))

  for (let i = 0; i + w <= points.length; i++) {
    const slice = points.slice(i, i + w)
    for (const key of featureNames) {
      windows[key]!.push(windowMeanForFeature(slice, key))
    }
  }

  const pear = matrixCorr(featureNames, windows, 'pearson')
  const spear = matrixCorr(featureNames, windows, 'spearman')
  return { pearson: pear, spearman: spear }
}

function matrixCorr(
  keys: string[],
  windows: Record<string, number[]>,
  mode: 'pearson' | 'spearman',
): { keys: string[]; values: (number | null)[][] } {
  const values = keys.map((a) =>
    keys.map((b) => {
      const x = windows[a]!.filter((v) => Number.isFinite(v))
      const y = windows[b]!.filter((v) => Number.isFinite(v))
      if (x.length !== windows[a]!.length || y.length !== windows[b]!.length) {
        const pairedX: number[] = []
        const pairedY: number[] = []
        for (let i = 0; i < windows[a]!.length; i++) {
          const xa = windows[a]![i]!
          const yb = windows[b]![i]!
          if (Number.isFinite(xa) && Number.isFinite(yb)) {
            pairedX.push(xa)
            pairedY.push(yb)
          }
        }
        return mode === 'pearson' ? pearson(pairedX, pairedY) : pearson(rank(pairedX), rank(pairedY))
      }
      return mode === 'pearson' ? pearson(windows[a]!, windows[b]!) : pearson(rank(windows[a]!), rank(windows[b]!))
    }),
  )
  return { keys, values }
}

function computeSurrogateImportance(points: ResampledPoint[]): FeatureImportance[] {
  const features = ['heartRate', 'hrvRmssd', 'spo2', 'systolic', 'diastolic', 'focusIndex']
  const rows: number[][] = []
  const y: number[] = []
  for (const p of points) {
    const row = features.map((f) => p.physical[f] ?? NaN)
    if (row.every((v) => Number.isFinite(v)) && Number.isFinite(p.negativeScore)) {
      rows.push(row as number[])
      y.push(p.negativeScore)
    }
  }
  if (rows.length < 12) return []
  const Xz = zCols(rows)
  const yz = z(y)
  const beta = olsBeta(Xz.map((r) => [1, ...r]), yz)
  if (!beta) return []
  const coefs = beta.slice(1).map((v) => Math.abs(v))
  const sum = coefs.reduce((a, b) => a + b, 0) || 1
  return features.map((f, i) => ({ feature: f, weight: coefs[i]! / sum })).sort((a, b) => b.weight - a.weight)
}

function computeMutualInfo(x: number[], y: number[], bins = 8): number | null {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) pairs.push([x[i]!, y[i]!])
  }
  if (pairs.length < 12) return null
  const xs = pairs.map((p) => p[0])
  const ys = pairs.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const px = new Array(bins).fill(0)
  const py = new Array(bins).fill(0)
  const pxy = Array.from({ length: bins }, () => new Array(bins).fill(0))
  const bx = (v: number) => Math.min(bins - 1, Math.floor(((v - minX) / (maxX - minX || 1e-9)) * bins))
  const by = (v: number) => Math.min(bins - 1, Math.floor(((v - minY) / (maxY - minY || 1e-9)) * bins))
  for (const [a, b] of pairs) {
    const i = bx(a)
    const j = by(b)
    px[i]++
    py[j]++
    pxy[i]![j]!++
  }
  const n = pairs.length
  let mi = 0
  for (let i = 0; i < bins; i++) {
    for (let j = 0; j < bins; j++) {
      const p = pxy[i]![j]! / n
      if (p <= 0) continue
      const q = (px[i]! / n) * (py[j]! / n)
      if (q <= 0) continue
      mi += p * Math.log2(p / q)
    }
  }
  return mi
}

function computePcaAlignment(points: ResampledPoint[]): number | null {
  const physFeatures = ['heartRate', 'hrvRmssd', 'spo2', 'focusIndex']
  const emFeatures = [...EMOTION_KEYS]
  const Xp: number[][] = []
  const Xe: number[][] = []
  for (const p of points) {
    const pr = physFeatures.map((k) => p.physical[k] ?? NaN)
    const er = emFeatures.map((k) => p.emotions[k] ?? NaN)
    if (pr.every(Number.isFinite) && er.every(Number.isFinite)) {
      Xp.push(pr as number[])
      Xe.push(er as number[])
    }
  }
  if (Xp.length < 12) return null
  const s1 = projectPc1(zCols(Xp))
  const s2 = projectPc1(zCols(Xe))
  return pearson(s1, s2)
}

function readPhys(p: ResampledPoint, key: string): number {
  const v = p.physical[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN
}

function baselineHead(series: number[], take = 12): number {
  const f = series.filter((x) => Number.isFinite(x))
  if (!f.length) return NaN
  return avg(f.slice(0, Math.min(take, f.length)))
}

function detectEvents(points: ResampledPoint[], stepMs: number): EventNarrative[] {
  const events: EventNarrative[] = []
  const hrvSeries = points.map((p) => readPhys(p, 'hrvRmssd'))
  const hrSeries = points.map((p) => readPhys(p, 'heartRate'))
  const focusSeries = points.map((p) => readPhys(p, 'focusIndex'))
  const spo2Series = points.map((p) => readPhys(p, 'spo2'))
  const sysSeries = points.map((p) => readPhys(p, 'systolic'))
  const diaSeries = points.map((p) => readPhys(p, 'diastolic'))
  const acSeries = points.map((p) => readPhys(p, 'autonomicConfidence'))
  const rhrSeries = points.map((p) => readPhys(p, 'restingHeartRate'))
  const tempSeries = points.map((p) => readPhys(p, 'bodyTempC'))

  const hrvBase = baselineHead(hrvSeries)
  const hrBase = baselineHead(hrSeries)
  const focusBase = baselineHead(focusSeries)
  const spo2Base = baselineHead(spo2Series)
  const sysBase = baselineHead(sysSeries)
  const diaBase = baselineHead(diaSeries)
  const acBase = baselineHead(acSeries)
  const rhrBase = baselineHead(rhrSeries)
  const tempBase = baselineHead(tempSeries)

  const win = Math.round(3000 / stepMs)

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!
    const before = points[Math.max(0, i - win)]!
    const after = points[Math.min(points.length - 1, i + win)]!
    const triggers: string[] = []

    const hrv = readPhys(p, 'hrvRmssd')
    if (Number.isFinite(hrvBase) && Number.isFinite(hrv) && hrv < 0.7 * hrvBase) triggers.push('HRV drop >30% vs baseline')
    if (Number.isFinite(hrvBase) && Number.isFinite(hrv) && hrv > 1.12 * hrvBase && before.physicalState === 'Stressed') {
      triggers.push('HRV recovery after stressed segment')
    }

    const hr = readPhys(p, 'heartRate')
    if (Number.isFinite(hrBase) && Number.isFinite(hr) && hr > hrBase + 10) triggers.push('HR above baseline +10 bpm')

    const fo = readPhys(p, 'focusIndex')
    if (Number.isFinite(focusBase) && Number.isFinite(fo) && fo < focusBase - 20) triggers.push('Focus index well below baseline')

    const sp = readPhys(p, 'spo2')
    if (Number.isFinite(spo2Base) && Number.isFinite(sp) && sp < spo2Base - 2 && sp >= 85) triggers.push('SpO2 dip vs baseline')

    const sys = readPhys(p, 'systolic')
    if (Number.isFinite(sysBase) && Number.isFinite(sys) && sys > sysBase + 8) triggers.push('Systolic BP rise vs baseline')

    const dia = readPhys(p, 'diastolic')
    if (Number.isFinite(diaBase) && Number.isFinite(dia) && dia > diaBase + 6) triggers.push('Diastolic BP rise vs baseline')

    const ac = readPhys(p, 'autonomicConfidence')
    if (Number.isFinite(acBase) && Number.isFinite(ac) && ac < acBase - 12) triggers.push('Autonomic confidence down vs baseline')

    const rhr = readPhys(p, 'restingHeartRate')
    if (Number.isFinite(rhrBase) && Number.isFinite(rhr) && rhr > rhrBase + 5) triggers.push('Resting HR above baseline')

    const bt = readPhys(p, 'bodyTempC')
    if (Number.isFinite(tempBase) && Number.isFinite(bt) && bt > tempBase + 0.35) triggers.push('Body temperature up vs baseline')

    if (p.negativeScore > before.negativeScore + 0.12 && p.negativeScore > 0.22) triggers.push('Negative score rise')
    if (before.valence - p.valence > 0.14) triggers.push('Valence drop')
    if (p.intensity > before.intensity + 0.15 && p.intensity > 0.55) triggers.push('Expression intensity spike')
    if (p.entropy > before.entropy + 0.08 && p.entropy > 0.35) triggers.push('Expression entropy rise')

    if (before.physicalState !== p.physicalState) {
      triggers.push(`Physical state ${before.physicalState} -> ${p.physicalState}`)
    }
    if (before.emotionalState !== p.emotionalState) {
      triggers.push(`Emotional state ${before.emotionalState} -> ${p.emotionalState}`)
    }

    if (!triggers.length) continue

    const emotionChanged = before.dominantEmotion !== p.dominantEmotion || after.dominantEmotion !== p.dominantEmotion
    const conf: EventNarrative['confidence'] = emotionChanged ? 'Medium' : 'Low'

    events.push({
      type: triggers.join(' · '),
      tMs: p.t,
      before: before.dominantEmotion,
      during: p.dominantEmotion,
      after: after.dominantEmotion,
      lagMs: 2000,
      confidence: conf,
    })
  }

  return dedupeEvents(events)
    .filter((e) => {
      const dom = e.before !== e.during || e.after !== e.during
      const physOrScalar =
        /HRV|HR |SpO2|Focus index|Systolic|Diastolic|Autonomic|Resting HR|Body temperature|Physical state|Emotional state|recovery/i.test(
          e.type,
        ) || /Negative score|Valence|Expression intensity|Expression entropy/i.test(e.type)
      return dom || physOrScalar
    })
    .slice(0, 18)
}

function dedupeEvents(events: EventNarrative[]) {
  const sorted = [...events].sort((a, b) => a.tMs - b.tMs)
  const out: EventNarrative[] = []
  const mergeWindowMs = 2600
  for (const e of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.tMs - e.tMs) < mergeWindowMs) {
      const parts = new Set<string>()
      for (const s of last.type.split(' · ')) {
        const t = s.trim()
        if (t) parts.add(t)
      }
      for (const s of e.type.split(' · ')) {
        const t = s.trim()
        if (t) parts.add(t)
      }
      last.type = [...parts].join(' · ')
      if (e.confidence === 'Medium') last.confidence = 'Medium'
      continue
    }
    out.push({ ...e })
  }
  return out
}

function avg(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
}

function avgNum(xs: Array<number | undefined>) {
  const f = xs.filter((x): x is number => Number.isFinite(x))
  return f.length ? avg(f) : NaN
}

function z(xs: number[]) {
  const m = avg(xs)
  const sd = Math.sqrt(avg(xs.map((v) => (v - m) ** 2))) || 1
  return xs.map((v) => (v - m) / sd)
}

function zCols(rows: number[][]) {
  const m = rows[0]!.length
  const cols = Array.from({ length: m }, (_, j) => rows.map((r) => r[j]!))
  const zc = cols.map((c) => z(c))
  return rows.map((_, i) => zc.map((c) => c[i]!))
}

function rank(values: number[]) {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(values.length).fill(0)
  let p = 0
  while (p < idx.length) {
    let q = p + 1
    while (q < idx.length && idx[q]!.v === idx[p]!.v) q++
    const avgRank = (p + q - 1) / 2 + 1
    for (let j = p; j < q; j++) ranks[idx[j]!.i] = avgRank
    p = q
  }
  return ranks
}

function projectPc1(X: number[][]) {
  const n = X.length
  const d = X[0]!.length
  const C = Array.from({ length: d }, () => new Array(d).fill(0))
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let s = 0
      for (let k = 0; k < n; k++) s += X[k]![i]! * X[k]![j]!
      C[i]![j] = s / Math.max(1, n - 1)
    }
  }
  let v = new Array(d).fill(1 / Math.sqrt(d))
  for (let iter = 0; iter < 40; iter++) {
    const nv = C.map((row) => row.reduce((acc, c, j) => acc + c * v[j]!, 0))
    const norm = Math.sqrt(nv.reduce((acc, x) => acc + x * x, 0)) || 1
    v = nv.map((x) => x / norm)
  }
  return X.map((r) => r.reduce((acc, x, j) => acc + x * v[j]!, 0))
}

function olsBeta(X: number[][], y: number[]) {
  const Xt = transpose(X)
  const XtX = mul(Xt, X)
  const Xty = mulVec(Xt, y)
  return solve(XtX, Xty)
}

function predictOls(X: number[][], y: number[]) {
  const b = olsBeta(X, y)
  if (!b) return y.map(() => 0)
  return X.map((r) => dot(r, b))
}

function sse(y: number[], pred: number[]) {
  let s = 0
  for (let i = 0; i < y.length; i++) {
    const e = y[i]! - pred[i]!
    s += e * e
  }
  return s
}

function transpose(A: number[][]) {
  return A[0]!.map((_, j) => A.map((r) => r[j]!))
}

function mul(A: number[][], B: number[][]) {
  const out = Array.from({ length: A.length }, () => new Array(B[0]!.length).fill(0))
  for (let i = 0; i < A.length; i++) {
    for (let k = 0; k < B.length; k++) {
      for (let j = 0; j < B[0]!.length; j++) out[i]![j]! += A[i]![k]! * B[k]![j]!
    }
  }
  return out
}

function mulVec(A: number[][], x: number[]) {
  return A.map((row) => row.reduce((acc, v, i) => acc + v * x[i]!, 0))
}

function dot(a: number[], b: number[]) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

function solve(A: number[][], b: number[]) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]!])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[piv]![i]!)) piv = r
    if (Math.abs(M[piv]![i]!) < 1e-9) return null
    ;[M[i], M[piv]] = [M[piv]!, M[i]!]
    const div = M[i]![i]!
    for (let c = i; c <= n; c++) M[i]![c]! /= div
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = M[r]![i]!
      for (let c = i; c <= n; c++) M[r]![c]! -= f * M[i]![c]!
    }
  }
  return M.map((row) => row[n]!)
}

function ridgeBeta(X: number[][], y: number[], lambda = 1) {
  const Xt = transpose(X)
  const XtX = mul(Xt, X)
  for (let i = 1; i < XtX.length; i++) XtX[i]![i]! += lambda
  const Xty = mulVec(Xt, y)
  return solve(XtX, Xty)
}

function fitStandardizer(rows: number[][]) {
  const d = rows[0]!.length
  const mean = new Array(d).fill(0)
  const sd = new Array(d).fill(1)
  for (let j = 0; j < d; j++) {
    const col = rows.map((r) => r[j]!)
    mean[j] = avg(col)
    sd[j] = Math.sqrt(avg(col.map((v) => (v - mean[j]!) ** 2))) || 1
  }
  return { mean, sd }
}

function transformWithStandardizer(rows: number[][], s: { mean: number[]; sd: number[] }) {
  return rows.map((r) => r.map((v, j) => (v - s.mean[j]!) / s.sd[j]!))
}

function r2(y: number[], pred: number[]) {
  const ym = avg(y)
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < y.length; i++) {
    const e = y[i]! - pred[i]!
    ssRes += e * e
    const d = y[i]! - ym
    ssTot += d * d
  }
  return ssTot <= 1e-9 ? 0 : 1 - ssRes / ssTot
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function safeZ(v: number, s: { mean: number[]; sd: number[] }, idx: number) {
  if (!Number.isFinite(v) || idx < 0) return 0
  return (v - s.mean[idx]!) / s.sd[idx]!
}

function prettyMetricName(token: string): string {
  const t = token.toLowerCase()
  if (t.includes('_delta')) return `${prettyMetricName(t.replace('_delta', ''))} delta`
  if (t.includes('_lag1')) return `${prettyMetricName(t.replace('_lag1', ''))} lag-1`
  if (t.includes('_roll3')) return `${prettyMetricName(t.replace('_roll3', ''))} rolling(3)`
  if (t.includes('_t0')) return prettyMetricName(t.replace('_t0', ''))
  if (t === 'hrvrmssd') return 'HRV (RMSSD)'
  if (t === 'heartrate') return 'Heart rate'
  if (t === 'focusindex') return 'Focus index'
  if (t === 'spo2') return 'SpO2'
  if (t === 'systolic') return 'Systolic BP'
  if (t === 'diastolic') return 'Diastolic BP'
  if (t === 'autonomicconfidence') return 'Autonomic confidence'
  if (t === 'caloriesactive') return 'Active calories'
  return token
}
