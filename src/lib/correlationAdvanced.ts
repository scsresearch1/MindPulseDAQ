import type { EmotionTimePoint, PhysicalTimePoint, SessionRecord } from '../types/mindpulseExport'
import { buildAlignedSeries, emotionValence, pearson } from './caseAnalytics'

export type EmotionPhysRow = {
  emotion: string
  rHeartRate: number | null
  rHrvRmssd: number | null
  rFocusIndex: number | null
}

export const EMOTION_KEYS = [
  'happy',
  'sadness',
  'anger',
  'fear',
  'disgust',
  'surprise',
  'neutral',
] as const

export type AlignedEmotionPhysSample = {
  sessionTimeMs: number
  valence: number
  heartRate: number
  hrvRmssd: number
  focusIndex: number | null
  happy: number
  sadness: number
  anger: number
  fear: number
  disgust: number
  surprise: number
  neutral: number
}

/** Hold-last alignment including full expression vector + key physiology per grid step. */
export function buildAlignedEmotionPhysGrid(
  emotion: EmotionTimePoint[] | undefined,
  physical: PhysicalTimePoint[] | undefined,
  stepMs = 400,
): AlignedEmotionPhysSample[] {
  const eSorted = emotion?.length ? [...emotion].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  const pSorted = physical?.length ? [...physical].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  if (!eSorted.length || !pSorted.length) return []

  const lastAtOrBefore = <T extends { sessionTimeMs: number }>(sorted: T[], t: number): T | null => {
    let lo = 0
    let hi = sorted.length - 1
    let best: T | null = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const m = sorted[mid]!
      if (m.sessionTimeMs <= t) {
        best = m
        lo = mid + 1
      } else hi = mid - 1
    }
    return best
  }

  const maxT = Math.max(
    eSorted[eSorted.length - 1]!.sessionTimeMs,
    pSorted[pSorted.length - 1]!.sessionTimeMs,
  )

  const out: AlignedEmotionPhysSample[] = []
  for (let t = 0; t <= maxT; t += stepMs) {
    const em = lastAtOrBefore(eSorted, t)
    const ph = lastAtOrBefore(pSorted, t)
    if (!em || !ph) continue
    out.push({
      sessionTimeMs: t,
      valence: emotionValence(em),
      heartRate: ph.heartRate,
      hrvRmssd: ph.hrvRmssd,
      focusIndex: typeof ph.focusIndex === 'number' ? ph.focusIndex : null,
      happy: em.happy,
      sadness: em.sadness,
      anger: em.anger,
      fear: em.fear,
      disgust: em.disgust,
      surprise: em.surprise,
      neutral: em.neutral,
    })
  }
  return out
}

export function emotionPhysiologyCorrelationMatrix(
  grid: AlignedEmotionPhysSample[],
  method: CorrMethod = 'pearson',
): EmotionPhysRow[] {
  const hr = grid.map((g) => g.heartRate)
  const hrv = grid.map((g) => g.hrvRmssd)
  const hasFocus = grid.length > 0 && grid.every((g) => typeof g.focusIndex === 'number')
  const focusAligned = hasFocus ? grid.map((g) => g.focusIndex as number) : []

  return EMOTION_KEYS.map((k) => ({
    emotion: k,
    rHeartRate: grid.length >= 4 ? pairwiseCorrMethod(grid.map((g) => g[k]), hr, method) : null,
    rHrvRmssd: grid.length >= 4 ? pairwiseCorrMethod(grid.map((g) => g[k]), hrv, method) : null,
    rFocusIndex:
      hasFocus && grid.length >= 4 ? pairwiseCorrMethod(grid.map((g) => g[k]), focusAligned as number[], method) : null,
  }))
}

export type FullCrossSeriesCorrelation = {
  emotionKeys: string[]
  physicalKeys: string[]
  values: (number | null)[][]
  alignedSamples: number
}

export type CorrMethod = 'pearson' | 'spearman'
export type CorrMode = 'emotion_physical' | 'physical_physical' | 'emotion_emotion'

export type ModeCorrelationResult = {
  rowKeys: string[]
  colKeys: string[]
  values: (number | null)[][]
  method: CorrMethod
  mode: CorrMode
  alignedSamples: number
}

export type SeriesBundle = {
  series: Record<string, Array<number | null>>
  emotionKeys: string[]
  physicalKeys: string[]
  alignedSamples: number
}

export function inferPhysicalDomain(key: string): string {
  const k = key.toLowerCase()
  if (k.includes('heart') || k.includes('hrv') || k.includes('focus')) return 'cardio-neuro'
  if (k.includes('spo2') || k.includes('oxygen')) return 'oxygenation'
  if (k.includes('systolic') || k.includes('diastolic') || k.includes('pressure')) return 'pressure'
  if (k.includes('temp')) return 'thermal'
  if (k.includes('step') || k.includes('distance') || k.includes('calories')) return 'activity'
  if (k.includes('autonomic')) return 'autonomic'
  return 'general'
}

/** Paired finite samples only; supports Pearson or Spearman (rank). */
function pairwiseCorrMethod(xs: number[], ys: Array<number | null | undefined>, method: CorrMethod): number | null {
  const fx: number[] = []
  const fy: number[] = []
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    fx.push(x)
    fy.push(y as number)
  }
  return correlation(fx, fy, method)
}

function pairwiseFinite(xs: Array<number | null | undefined>, ys: Array<number | null | undefined>) {
  const fx: number[] = []
  const fy: number[] = []
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    fx.push(x as number)
    fy.push(y as number)
  }
  return { fx, fy }
}

function rank(values: number[]): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(values.length).fill(0)
  let p = 0
  while (p < idx.length) {
    let q = p + 1
    while (q < idx.length && idx[q]!.v === idx[p]!.v) q++
    const avg = (p + q - 1) / 2 + 1
    for (let j = p; j < q; j++) ranks[idx[j]!.i] = avg
    p = q
  }
  return ranks
}

function correlation(xs: Array<number | null | undefined>, ys: Array<number | null | undefined>, method: CorrMethod) {
  const { fx, fy } = pairwiseFinite(xs, ys)
  if (method === 'pearson') return pearson(fx, fy)
  if (fx.length < 4) return null
  return pearson(rank(fx), rank(fy))
}

function lastAtOrBefore<T extends { sessionTimeMs: number }>(sorted: T[], t: number): T | null {
  let lo = 0
  let hi = sorted.length - 1
  let best: T | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const m = sorted[mid]!
    if (m.sessionTimeMs <= t) {
      best = m
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export function buildAlignedSeriesBundle(
  emotion: EmotionTimePoint[] | undefined,
  physical: PhysicalTimePoint[] | undefined,
  stepMs = 400,
): SeriesBundle {
  const eSorted = emotion?.length ? [...emotion].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  const pSorted = physical?.length ? [...physical].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  if (!eSorted.length || !pSorted.length) {
    return { series: {}, emotionKeys: [...EMOTION_KEYS], physicalKeys: [], alignedSamples: 0 }
  }

  const physicalKeySet = new Set<string>()
  for (const p of pSorted) {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'sessionTimeMs' || k === 'caseId') continue
      if (typeof v === 'number' && Number.isFinite(v)) physicalKeySet.add(k)
    }
  }
  const physicalKeys = [...physicalKeySet].sort()
  const emotionKeys = [...EMOTION_KEYS, 'valence']
  const series: Record<string, Array<number | null>> = {}
  for (const k of emotionKeys) series[k] = []
  for (const k of physicalKeys) series[k] = []

  const maxT = Math.max(
    eSorted[eSorted.length - 1]!.sessionTimeMs,
    pSorted[pSorted.length - 1]!.sessionTimeMs,
  )
  let alignedSamples = 0
  for (let t = 0; t <= maxT; t += stepMs) {
    const em = lastAtOrBefore(eSorted, t)
    const ph = lastAtOrBefore(pSorted, t)
    if (!em || !ph) continue
    alignedSamples++
    for (const ek of EMOTION_KEYS) series[ek]!.push(em[ek])
    series.valence!.push(emotionValence(em))
    for (const pk of physicalKeys) {
      const v = ph[pk]
      series[pk]!.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
    }
  }
  return { series, emotionKeys, physicalKeys, alignedSamples }
}

export function computeModeCorrelation(
  bundle: SeriesBundle,
  mode: CorrMode,
  method: CorrMethod,
): ModeCorrelationResult {
  const { series, emotionKeys, physicalKeys, alignedSamples } = bundle
  let rowKeys: string[] = []
  let colKeys: string[] = []
  if (mode === 'emotion_physical') {
    rowKeys = emotionKeys
    colKeys = physicalKeys
  } else if (mode === 'physical_physical') {
    rowKeys = physicalKeys
    colKeys = physicalKeys
  } else {
    rowKeys = emotionKeys
    colKeys = emotionKeys
  }

  const values: (number | null)[][] = rowKeys.map((rk) =>
    colKeys.map((ck) => {
      if (rk === ck) return 1
      return correlation(series[rk] ?? [], series[ck] ?? [], method)
    }),
  )

  return { rowKeys, colKeys, values, method, mode, alignedSamples }
}

export function fullCrossSeriesCorrelation(
  emotion: EmotionTimePoint[] | undefined,
  physical: PhysicalTimePoint[] | undefined,
  stepMs = 400,
  method: CorrMethod = 'pearson',
): FullCrossSeriesCorrelation {
  const eSorted = emotion?.length ? [...emotion].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  const pSorted = physical?.length ? [...physical].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs) : []
  if (!eSorted.length || !pSorted.length) {
    return { emotionKeys: [...EMOTION_KEYS], physicalKeys: [], values: [], alignedSamples: 0 }
  }

  const physicalKeySet = new Set<string>()
  for (const p of pSorted) {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'sessionTimeMs' || k === 'caseId') continue
      if (typeof v === 'number' && Number.isFinite(v)) physicalKeySet.add(k)
    }
  }
  const physicalKeys = [...physicalKeySet].sort()

  const lastAtOrBefore = <T extends { sessionTimeMs: number }>(sorted: T[], t: number): T | null => {
    let lo = 0
    let hi = sorted.length - 1
    let best: T | null = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const m = sorted[mid]!
      if (m.sessionTimeMs <= t) {
        best = m
        lo = mid + 1
      } else hi = mid - 1
    }
    return best
  }

  const maxT = Math.max(
    eSorted[eSorted.length - 1]!.sessionTimeMs,
    pSorted[pSorted.length - 1]!.sessionTimeMs,
  )

  const emotionSeries: Record<string, number[]> = {}
  const physicalSeries: Record<string, Array<number | null>> = {}
  for (const ek of EMOTION_KEYS) emotionSeries[ek] = []
  for (const pk of physicalKeys) physicalSeries[pk] = []

  let alignedSamples = 0
  for (let t = 0; t <= maxT; t += stepMs) {
    const em = lastAtOrBefore(eSorted, t)
    const ph = lastAtOrBefore(pSorted, t)
    if (!em || !ph) continue
    alignedSamples++
    for (const ek of EMOTION_KEYS) emotionSeries[ek]!.push(em[ek])
    for (const pk of physicalKeys) {
      const v = ph[pk]
      physicalSeries[pk]!.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
    }
  }

  const values: (number | null)[][] = EMOTION_KEYS.map((ek) =>
    physicalKeys.map((pk) => pairwiseCorrMethod(emotionSeries[ek]!, physicalSeries[pk]!, method)),
  )

  return { emotionKeys: [...EMOTION_KEYS], physicalKeys, values, alignedSamples }
}

export type LagPoint = { lagSteps: number; lagMs: number; r: number | null }

/** Lag &gt; 0: valence leads HRV (compare valence[t] to HRV[t+lag]). Lag &lt; 0: HRV leads valence. */
export function laggedValenceHrvCorrelations(
  valence: number[],
  hrv: number[],
  stepMs: number,
  maxLagSteps = 8,
  method: CorrMethod = 'pearson',
): LagPoint[] {
  const out: LagPoint[] = []
  for (let lag = -maxLagSteps; lag <= maxLagSteps; lag++) {
    let xs: number[]
    let ys: number[]
    if (lag === 0) {
      xs = valence
      ys = hrv
    } else if (lag > 0) {
      xs = valence.slice(0, -lag)
      ys = hrv.slice(lag)
    } else {
      const L = -lag
      xs = valence.slice(L)
      ys = hrv.slice(0, -L)
    }
    out.push({
      lagSteps: lag,
      lagMs: lag * stepMs,
      r: correlation(xs, ys, method),
    })
  }
  return out
}

export type RollingRPoint = { sessionTimeMs: number; r: number | null }

export function rollingValenceHrvCorrelation(
  aligned: { sessionTimeMs: number; valence: number; hrvRmssd: number }[],
  windowPoints = 8,
  method: CorrMethod = 'pearson',
): RollingRPoint[] {
  if (aligned.length < windowPoints + 1) return []
  const out: RollingRPoint[] = []
  for (let i = windowPoints - 1; i < aligned.length; i++) {
    const slice = aligned.slice(i - windowPoints + 1, i + 1)
    const r = correlation(
      slice.map((s) => s.valence),
      slice.map((s) => s.hrvRmssd),
      method,
    )
    out.push({ sessionTimeMs: aligned[i]!.sessionTimeMs, r })
  }
  return out
}

export type OlsLine = { slope: number; intercept: number; r2: number }

/** OLS: HRV ~ valence (for scatter y vs x where x valence, y hrv). */
export function olsHrvOnValence(valence: number[], hrv: number[]): OlsLine | null {
  if (valence.length !== hrv.length || valence.length < 4) return null
  const mx = valence.reduce((a, b) => a + b, 0) / valence.length
  const my = hrv.reduce((a, b) => a + b, 0) / hrv.length
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < valence.length; i++) {
    const vx = valence[i]! - mx
    const vy = hrv[i]! - my
    sxx += vx * vx
    sxy += vx * vy
    syy += vy * vy
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) }
}

export type SessionCorrelationPack = {
  grid: AlignedEmotionPhysSample[]
  matrix: EmotionPhysRow[]
  fullMatrix: FullCrossSeriesCorrelation
  lagged: LagPoint[]
  rolling: RollingRPoint[]
  ols: OlsLine | null
  zeroLagR: number | null
  bestLag: LagPoint | null
}

export function buildSessionCorrelationPack(
  session: SessionRecord,
  stepMs = 400,
  method: CorrMethod = 'pearson',
): SessionCorrelationPack {
  const emotion = session.emotionTimeSeries
  const physical = session.physicalTimeSeries
  const grid = buildAlignedEmotionPhysGrid(emotion, physical, stepMs)
  const matrix = emotionPhysiologyCorrelationMatrix(grid, method)
  const fullMatrix = fullCrossSeriesCorrelation(emotion, physical, stepMs, method)

  const alignedSimple = buildAlignedSeries(emotion, physical, stepMs)
  const valence = alignedSimple.map((a) => a.valence)
  const hrv = alignedSimple.map((a) => a.hrvRmssd)
  const zeroLagR = valence.length >= 4 ? correlation(valence, hrv, method) : null
  const lagged = laggedValenceHrvCorrelations(valence, hrv, stepMs, 8, method)
  const rolling = rollingValenceHrvCorrelation(alignedSimple, 8, method)

  let bestLag: LagPoint | null = null
  for (const L of lagged) {
    if (L.r === null) continue
    if (!bestLag) {
      bestLag = L
      continue
    }
    const prev = bestLag.r
    if (prev === null || Math.abs(L.r) > Math.abs(prev)) bestLag = L
  }

  const ols = olsHrvOnValence(valence, hrv)

  return { grid, matrix, fullMatrix, lagged, rolling, ols, zeroLagR, bestLag }
}
