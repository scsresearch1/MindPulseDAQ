import type { EmotionTimePoint, PhysicalTimePoint, SessionRecord } from '../types/mindpulseExport'

const EM_KEYS = ['neutral', 'happy', 'sadness', 'anger', 'fear', 'disgust', 'surprise'] as const

/** Bounded proxy: positive affect minus negative affect (neutral excluded). Range roughly [-1, 1]. */
export function emotionValence(e: EmotionTimePoint): number {
  const pos = e.happy + 0.45 * e.surprise
  const neg = e.sadness + e.anger + e.fear + e.disgust
  const v = pos - neg
  return Math.max(-1, Math.min(1, v))
}

export function dominantEmotionLabel(e: EmotionTimePoint): (typeof EM_KEYS)[number] {
  let best: (typeof EM_KEYS)[number] = 'neutral'
  let max = -1
  for (const k of EM_KEYS) {
    if (e[k] > max) {
      max = e[k]
      best = k
    }
  }
  return best
}

function sortByTime<T extends { sessionTimeMs: number }>(arr: T[] | undefined): T[] {
  if (!arr?.length) return []
  return [...arr].sort((a, b) => a.sessionTimeMs - b.sessionTimeMs)
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

export type AlignedSample = {
  sessionTimeMs: number
  valence: number
  emotions: {
    neutral: number
    happy: number
    sadness: number
    anger: number
    fear: number
    disgust: number
    surprise: number
  }
  hrvRmssd: number
  heartRate: number
  focusIndex?: number
  spo2?: number
  physical: Record<string, number>
  mentalLoad?: string
  autonomicState?: string
}

export function buildAlignedSeries(
  emotion: EmotionTimePoint[] | undefined,
  physical: PhysicalTimePoint[] | undefined,
  stepMs = 400,
): AlignedSample[] {
  const eSorted = sortByTime(emotion)
  const pSorted = sortByTime(physical)
  if (!eSorted.length || !pSorted.length) return []

  const maxT = Math.max(
    eSorted[eSorted.length - 1]!.sessionTimeMs,
    pSorted[pSorted.length - 1]!.sessionTimeMs,
  )

  const out: AlignedSample[] = []
  for (let t = 0; t <= maxT; t += stepMs) {
    const em = lastAtOrBefore(eSorted, t)
    const ph = lastAtOrBefore(pSorted, t)
    if (!em || !ph) continue
    out.push({
      sessionTimeMs: t,
      valence: emotionValence(em),
      emotions: {
        neutral: em.neutral,
        happy: em.happy,
        sadness: em.sadness,
        anger: em.anger,
        fear: em.fear,
        disgust: em.disgust,
        surprise: em.surprise,
      },
      hrvRmssd: ph.hrvRmssd,
      heartRate: ph.heartRate,
      focusIndex: ph.focusIndex,
      spo2: ph.spo2,
      physical: Object.fromEntries(
        Object.entries(ph).filter(
          ([k, v]) =>
            k !== 'sessionTimeMs' &&
            k !== 'caseId' &&
            k !== 'mentalLoad' &&
            k !== 'autonomicState' &&
            typeof v === 'number' &&
            Number.isFinite(v),
        ),
      ) as Record<string, number>,
      mentalLoad: ph.mentalLoad,
      autonomicState: ph.autonomicState,
    })
  }
  return out
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 4) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    const vx = xs[i]! - mx
    const vy = ys[i]! - my
    num += vx * vy
    dx += vx * vx
    dy += vy * vy
  }
  const den = Math.sqrt(dx * dy)
  if (den === 0) return null
  return num / den
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

export type CaseAnalysis = {
  sessionKey: string
  caseId: string
  headline: string
  observations: string[]
  metrics: {
    durationMs: number
    emotionSamples: number
    physicalSamples: number
    meanValence: number | null
    stdValence: number | null
    meanHrvMs: number | null
    minHrvMs: number | null
    maxHrvMs: number | null
    meanHr: number | null
    valenceHrvPearsonR: number | null
    pctHighMentalLoad: number | null
    pctStressedAutonomic: number | null
    meanNeutralProb: number | null
    meanDisgustProb: number | null
    spo2Min: number | null
    focusIndexRange: { min: number; max: number } | null
  }
}

export function analyzeSession(session: SessionRecord): CaseAnalysis {
  const emotion = sortByTime(session.emotionTimeSeries)
  const physical = sortByTime(session.physicalTimeSeries)
  const caseId = session.caseId ?? '—'

  const durationMs = Math.max(
    emotion[emotion.length - 1]?.sessionTimeMs ?? 0,
    physical[physical.length - 1]?.sessionTimeMs ?? 0,
  )

  const valences = emotion.map(emotionValence)
  const meanValence = valences.length ? mean(valences) : null
  const stdValence = valences.length ? std(valences) : null

  const hrvs = physical.map((p) => p.hrvRmssd).filter((n) => typeof n === 'number')
  const hrs = physical.map((p) => p.heartRate).filter((n) => typeof n === 'number')

  const aligned = buildAlignedSeries(emotion, physical, 400)
  const rValHrv =
    aligned.length >= 4
      ? pearson(
          aligned.map((a) => a.valence),
          aligned.map((a) => a.hrvRmssd),
        )
      : null

  let highMental = 0
  let stressedAuto = 0
  for (const p of physical) {
    if (p.mentalLoad === 'High') highMental++
    if (p.autonomicState === 'Stressed') stressedAuto++
  }
  const pctHighMentalLoad = physical.length ? (100 * highMental) / physical.length : null
  const pctStressedAutonomic = physical.length ? (100 * stressedAuto) / physical.length : null

  const neutrals = emotion.map((e) => e.neutral)
  const disgusts = emotion.map((e) => e.disgust)
  const meanNeutralProb = neutrals.length ? mean(neutrals) : null
  const meanDisgustProb = disgusts.length ? mean(disgusts) : null

  const spo2s = physical.map((p) => p.spo2).filter((n): n is number => typeof n === 'number')
  const spo2Min = spo2s.length ? Math.min(...spo2s) : null

  const focuses = physical.map((p) => p.focusIndex).filter((n): n is number => typeof n === 'number')
  const focusIndexRange =
    focuses.length > 0
      ? { min: Math.min(...focuses), max: Math.max(...focuses) }
      : null

  const observations: string[] = []

  if (rValHrv !== null) {
    const dir = rValHrv > 0 ? 'positive' : 'negative'
    observations.push(
      `Emotional valence vs physical RMSSD (n=${aligned.length}, 400 ms): Pearson r=${rValHrv.toFixed(3)} (${dir}).`,
    )
  }

  if (pctStressedAutonomic !== null && pctStressedAutonomic > 40) {
    observations.push(`Autonomic "Stressed" on ${pctStressedAutonomic.toFixed(0)}% of physical samples.`)
  }

  if (emotion.length) {
    const peak = emotion.reduce((m, e) => (e.disgust > m.disgust ? e : m), emotion[0]!)
    if (peak.disgust > 0.35) {
      observations.push(
        `Disgust peak ${(peak.disgust * 100).toFixed(1)}% @ ${(peak.sessionTimeMs / 1000).toFixed(1)}s — check frames/lighting.`,
      )
    }
  }

  if (spo2Min !== null && spo2Min < 92) {
    observations.push(`SpO₂ min ${spo2Min}% in stream — verify sensor fit.`)
  }

  if (stdValence !== null && stdValence < 0.08 && meanNeutralProb !== null && meanNeutralProb > 0.85) {
    observations.push('High neutral / flat valence — possible low expression signal.')
  }

  if (observations.length === 0) {
    observations.push('Little to flag in automated checks for this session.')
  }

  const headline =
    rValHrv !== null && Math.abs(rValHrv) >= 0.25
      ? `Physical–emotional: valence vs RMSSD |r|≥0.25 in this window (r=${rValHrv.toFixed(2)}).`
      : 'Session loaded — inspect physical–emotional plots for detail.'

  return {
    sessionKey: session.sessionKey,
    caseId,
    headline,
    observations,
    metrics: {
      durationMs: durationMs,
      emotionSamples: emotion.length,
      physicalSamples: physical.length,
      meanValence,
      stdValence,
      meanHrvMs: hrvs.length ? mean(hrvs) : null,
      minHrvMs: hrvs.length ? Math.min(...hrvs) : null,
      maxHrvMs: hrvs.length ? Math.max(...hrvs) : null,
      meanHr: hrs.length ? mean(hrs) : null,
      valenceHrvPearsonR: rValHrv,
      pctHighMentalLoad,
      pctStressedAutonomic,
      meanNeutralProb,
      meanDisgustProb,
      spo2Min,
      focusIndexRange,
    },
  }
}
