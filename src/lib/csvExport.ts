import type { SessionRecord } from '../types/mindpulseExport'
import { buildAlignedSeries, dominantEmotionLabel, type AlignedSample } from './caseAnalytics'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
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

function genderEncoded(g?: string): string {
  const x = (g ?? '').trim().toLowerCase()
  if (!x) return ''
  if (x.startsWith('m')) return '1'
  if (x.startsWith('f')) return '2'
  return '0'
}

function encodeAutonomicState(s?: string): string {
  const x = (s ?? '').toLowerCase()
  if (!x) return ''
  if (x.includes('stress')) return '2'
  if (x.includes('focus')) return '1'
  if (x.includes('recover')) return '3'
  if (x.includes('balance')) return '0'
  return '0'
}

function encodeAutonomicStability(s?: string): string {
  const x = (s ?? '').toLowerCase()
  if (!x) return ''
  if (x.includes('high') || x.includes('stable')) return '2'
  if (x.includes('med') || x.includes('moderate')) return '1'
  if (x.includes('low') || x.includes('unstable')) return '0'
  return '0'
}

function encodeMentalLoad(s?: string): string {
  const x = (s ?? '').toLowerCase()
  if (!x) return ''
  if (x.includes('high')) return '2'
  if (x.includes('med') || x.includes('moderate')) return '1'
  if (x.includes('low')) return '0'
  return '0'
}

function encodeCognitiveReadiness(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v))
  if (typeof v === 'string') {
    const x = v.toLowerCase()
    if (x.includes('high')) return '2'
    if (x.includes('med')) return '1'
    if (x.includes('low')) return '0'
  }
  return '0'
}

function emotionShannon(probs: number[]): number {
  let s = 0
  for (const p0 of probs) {
    const p = Math.max(1e-12, p0)
    s += -p * Math.log2(p)
  }
  return s
}

function dominantEmotionCode(label: string): string {
  const map: Record<string, string> = {
    neutral: '0',
    happy: '1',
    sadness: '2',
    anger: '3',
    fear: '4',
    disgust: '5',
    surprise: '6',
  }
  return map[label] ?? ''
}

function physicalStateLabel(hrv: number, autonomic?: string): string {
  const a = (autonomic ?? '').toLowerCase()
  if (a.includes('stress')) return 'Stressed'
  if (a.includes('focus')) return 'Focused'
  if (Number.isFinite(hrv) && hrv <= 30) return 'Stressed'
  if (Number.isFinite(hrv) && hrv >= 50) return 'Focused'
  return 'Recovery'
}

function emotionalStateLabel(em: AlignedSample['emotions']): string {
  const neg = em.anger + em.fear + em.disgust + em.sadness
  const pos = em.happy + 0.5 * em.surprise
  const dom = dominantEmotionLabel({
    sessionTimeMs: 0,
    anger: em.anger,
    disgust: em.disgust,
    fear: em.fear,
    happy: em.happy,
    neutral: em.neutral,
    sadness: em.sadness,
    surprise: em.surprise,
  })
  if (dom === 'neutral') return 'Neutral'
  return neg >= pos ? 'Negative' : 'Positive'
}

function stressLabel(flags: { hrvDrop: boolean; hrSpike: boolean; stressOn: boolean; emoSpike: boolean }): string {
  if (flags.stressOn || flags.hrvDrop) return 'high'
  if (flags.hrSpike || flags.emoSpike) return 'elevated'
  return 'low'
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function rollingMeanStd(
  series: number[],
  i: number,
  win: number,
): { mean: number; std: number } | null {
  const start = Math.max(0, i - win + 1)
  const slice = series.slice(start, i + 1).filter((x) => Number.isFinite(x))
  if (slice.length === 0) return null
  if (slice.length === 1) return { mean: slice[0]!, std: 0 }
  return { mean: mean(slice), std: std(slice) }
}

function numCell(v: number | null | undefined, digits?: number): string {
  if (v == null || !Number.isFinite(v)) return ''
  if (digits != null) return v.toFixed(digits)
  return String(v)
}

/** Exact header order for pilot wide export (63 columns). */
export const WIDE_EXPORT_HEADERS = [
  'session_id',
  'case_id',
  'participant_id',
  'timestamp_ms',
  'relative_time_ms',
  'time_index',
  'age',
  'gender_encoded',
  'heart_rate_bpm',
  'hrv_rmssd_ms',
  'spo2_percent',
  'systolic_bp',
  'diastolic_bp',
  'body_temp_c',
  'hr_delta',
  'hrv_delta',
  'hrv_slope',
  'hrv_rolling_mean_3s',
  'hrv_rolling_std_3s',
  'hr_rolling_mean_3s',
  'hr_rolling_std_3s',
  'sensor_confidence',
  'signal_quality_index',
  'motion_artifact_flag',
  'spo2_valid_flag',
  'autonomic_state_encoded',
  'autonomic_stability_encoded',
  'mental_load_encoded',
  'cognitive_readiness_encoded',
  'calories_active',
  'activity_level',
  'barometric_pressure',
  'focus_index',
  'focus_delta',
  'focus_rolling_mean_3s',
  'emotion_anger',
  'emotion_disgust',
  'emotion_fear',
  'emotion_happy',
  'emotion_neutral',
  'emotion_sadness',
  'emotion_surprise',
  'dominant_emotion_encoded',
  'emotion_entropy',
  'emotion_intensity',
  'emotion_variability',
  'negative_emotion_score',
  'positive_emotion_score',
  'valence_score',
  'arousal_proxy',
  'lag_hrv_1',
  'lag_hrv_2',
  'lag_hrv_3',
  'lag_emotion_valence_1',
  'lag_emotion_valence_2',
  'lag_emotion_valence_3',
  'event_hrv_drop_flag',
  'event_hr_spike_flag',
  'event_stress_onset_flag',
  'event_emotion_spike_flag',
  'physical_state_label',
  'emotional_state_label',
  'stress_label',
] as const

function buildWideRowsForSession(session: SessionRecord, stepMs: number): string[][] {
  const emotion = session.emotionTimeSeries
  const physical = session.physicalTimeSeries
  const pSorted = sortByTime(physical)
  const aligned = buildAlignedSeries(emotion, physical, stepMs)
  if (!aligned.length) return []

  const hrvHead = aligned
    .slice(0, Math.min(12, aligned.length))
    .map((a) => a.hrvRmssd)
    .filter((x) => Number.isFinite(x))
  const hrHead = aligned
    .slice(0, Math.min(12, aligned.length))
    .map((a) => a.heartRate)
    .filter((x) => Number.isFinite(x))
  const hrvBase = hrvHead.length ? mean(hrvHead) : NaN
  const hrBase = hrHead.length ? mean(hrHead) : NaN

  const winSteps = Math.max(2, Math.round(3000 / stepMs))
  const hrSeries = aligned.map((a) => a.heartRate)
  const hrvSeries = aligned.map((a) => a.hrvRmssd)
  const focusSeries = aligned.map((a) => (typeof a.focusIndex === 'number' ? a.focusIndex : NaN))

  const rows: string[][] = []

  for (let i = 0; i < aligned.length; i++) {
    const a = aligned[i]!
    const t = a.sessionTimeMs
    const ph = lastAtOrBefore(pSorted, t)

    const hr = a.heartRate
    const hrv = a.hrvRmssd
    const hrPrev = i > 0 ? aligned[i - 1]!.heartRate : NaN
    const hrvPrev = i > 0 ? aligned[i - 1]!.hrvRmssd : NaN
    const hrvNext = i + 1 < aligned.length ? aligned[i + 1]!.hrvRmssd : NaN

    const hrDelta = i > 0 && Number.isFinite(hr) && Number.isFinite(hrPrev) ? hr - hrPrev : NaN
    const hrvDelta = i > 0 && Number.isFinite(hrv) && Number.isFinite(hrvPrev) ? hrv - hrvPrev : NaN
    const hrvSlope =
      i > 0 && i + 1 < aligned.length && Number.isFinite(hrvNext) && Number.isFinite(hrvPrev)
        ? (hrvNext - hrvPrev) / (2 * stepMs)
        : NaN

    const hrvRoll = rollingMeanStd(hrvSeries, i, winSteps)
    const hrRoll = rollingMeanStd(hrSeries, i, winSteps)

    const fi = typeof a.focusIndex === 'number' ? a.focusIndex : NaN
    const fiPrev = i > 0 && typeof aligned[i - 1]!.focusIndex === 'number' ? aligned[i - 1]!.focusIndex! : NaN
    const focusDelta = i > 0 && Number.isFinite(fi) && Number.isFinite(fiPrev) ? fi - fiPrev : NaN
    const focusStart = Math.max(0, i - winSteps + 1)
    const focusWin = focusSeries.slice(focusStart, i + 1).filter((x): x is number => Number.isFinite(x))
    const focusRollMean = focusWin.length >= 1 ? mean(focusWin) : NaN

    const probs = [
      a.emotions.neutral,
      a.emotions.happy,
      a.emotions.sadness,
      a.emotions.anger,
      a.emotions.fear,
      a.emotions.disgust,
      a.emotions.surprise,
    ]
    const entropy = emotionShannon(probs)
    const intensity = Math.max(...probs)
    const variability = std(probs)

    const negScore = a.emotions.anger + a.emotions.fear + a.emotions.disgust + a.emotions.sadness
    const posScore = a.emotions.happy + 0.5 * a.emotions.surprise
    const valenceScore = posScore - negScore
    const arousalProxy = 1 - a.emotions.neutral

    const emAt = (idx: number) => (idx >= 0 ? aligned[idx]! : null)
    const lagHrv = (lag: number) => {
      const j = i - lag
      const s = emAt(j)
      return s && Number.isFinite(s.hrvRmssd) ? s.hrvRmssd : NaN
    }
    const lagVal = (lag: number) => {
      const j = i - lag
      const s = emAt(j)
      return s ? s.valence : NaN
    }

    const spo2 = a.spo2
    const spo2Valid = typeof spo2 === 'number' && spo2 >= 85 && spo2 <= 100 ? 1 : 0

    const sensorConf =
      ph && typeof ph.autonomicConfidence === 'number' && Number.isFinite(ph.autonomicConfidence)
        ? ph.autonomicConfidence
        : (a.physical.autonomicConfidence ?? NaN)

    const phys = a.physical as Record<string, number | undefined>
    const systolic = phys.systolic
    const diastolic = phys.diastolic
    const bodyTemp = phys.bodyTempC
    const calories = phys.caloriesActive ?? phys.caloriesactive
    const barometric = phys.barometricPressure ?? phys.barometricpressure
    const activityLevel =
      (ph &&
        (typeof ph['activityLevel'] === 'string'
          ? (ph['activityLevel'] as string)
          : typeof ph['activityLevel'] === 'number'
            ? String(ph['activityLevel'])
            : '')) ||
      ''

    const cognitiveRaw = ph ? (ph as Record<string, unknown>)['cognitiveReadiness'] : undefined

    const domLabel = dominantEmotionLabel({
      sessionTimeMs: t,
      anger: a.emotions.anger,
      disgust: a.emotions.disgust,
      fear: a.emotions.fear,
      happy: a.emotions.happy,
      neutral: a.emotions.neutral,
      sadness: a.emotions.sadness,
      surprise: a.emotions.surprise,
    })

    const autoStab = ph?.autonomicStability

    const hrvDrop = Number.isFinite(hrvBase) && Number.isFinite(hrv) && hrv < 0.7 * hrvBase
    const hrSpike = Number.isFinite(hrBase) && Number.isFinite(hr) && hr > hrBase + 10
    const stressOn = (ph?.autonomicState ?? a.autonomicState ?? '').toLowerCase().includes('stress')
    const prevNeg =
      i > 0
        ? aligned[i - 1]!.emotions.anger +
          aligned[i - 1]!.emotions.fear +
          aligned[i - 1]!.emotions.disgust +
          aligned[i - 1]!.emotions.sadness
        : NaN
    const emoSpike = i > 0 && Number.isFinite(prevNeg) && negScore > prevNeg + 0.12 && negScore > 0.22

    const physLabel = physicalStateLabel(hrv, ph?.autonomicState ?? a.autonomicState)
    const emoLabel = emotionalStateLabel(a.emotions)
    const stress = stressLabel({ hrvDrop, hrSpike, stressOn, emoSpike })

    const participantId =
      session.participantName ?? session.consent?.participantName ?? session.sessionKey

    rows.push(
      [
        session.sessionKey,
        session.caseId ?? '',
        participantId,
        String(t),
        String(t),
        String(i),
        session.age != null ? String(session.age) : '',
        genderEncoded(session.gender),
        numCell(hr, 2),
        numCell(hrv, 2),
        numCell(spo2, 2),
        numCell(systolic, 1),
        numCell(diastolic, 1),
        numCell(bodyTemp, 2),
        numCell(hrDelta, 3),
        numCell(hrvDelta, 3),
        numCell(hrvSlope, 6),
        hrvRoll ? numCell(hrvRoll.mean, 3) : '',
        hrvRoll ? numCell(hrvRoll.std, 3) : '',
        hrRoll ? numCell(hrRoll.mean, 3) : '',
        hrRoll ? numCell(hrRoll.std, 3) : '',
        numCell(sensorConf, 2),
        '',
        '0',
        spo2Valid ? '1' : typeof spo2 === 'number' ? '0' : '',
        encodeAutonomicState(ph?.autonomicState ?? a.autonomicState),
        encodeAutonomicStability(autoStab),
        encodeMentalLoad(ph?.mentalLoad ?? a.mentalLoad),
        encodeCognitiveReadiness(cognitiveRaw),
        calories != null && Number.isFinite(calories) ? String(calories) : '',
        activityLevel,
        barometric != null && Number.isFinite(barometric) ? String(barometric) : '',
        numCell(fi, 2),
        numCell(focusDelta, 3),
        Number.isFinite(focusRollMean) ? numCell(focusRollMean, 3) : '',
        numCell(a.emotions.anger, 4),
        numCell(a.emotions.disgust, 4),
        numCell(a.emotions.fear, 4),
        numCell(a.emotions.happy, 4),
        numCell(a.emotions.neutral, 4),
        numCell(a.emotions.sadness, 4),
        numCell(a.emotions.surprise, 4),
        dominantEmotionCode(domLabel),
        numCell(entropy, 4),
        numCell(intensity, 4),
        numCell(variability, 4),
        numCell(negScore, 4),
        numCell(posScore, 4),
        numCell(valenceScore, 4),
        numCell(arousalProxy, 4),
        numCell(lagHrv(1), 3),
        numCell(lagHrv(2), 3),
        numCell(lagHrv(3), 3),
        numCell(lagVal(1), 4),
        numCell(lagVal(2), 4),
        numCell(lagVal(3), 4),
        String(hrvDrop ? 1 : 0),
        String(hrSpike ? 1 : 0),
        String(stressOn ? 1 : 0),
        String(emoSpike ? 1 : 0),
        physLabel,
        emoLabel,
        stress,
      ].map(csvEscape),
    )
  }

  return rows
}

/**
 * Wide pilot export: one CSV row per aligned sample (default 400 ms grid) for all loaded sessions.
 * Column order matches WIDE_EXPORT_HEADERS (63 columns).
 */
export function buildSessionsCsvRows(sessions: SessionRecord[], stepMs = 400): string {
  const lines = [WIDE_EXPORT_HEADERS.join(',')]
  for (const session of sessions) {
    for (const row of buildWideRowsForSession(session, stepMs)) {
      lines.push(row.join(','))
    }
  }
  return lines.join('\r\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
