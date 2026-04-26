import type { CaseAnalysis } from './caseAnalytics'
import type { EmotionPhysRow, SessionCorrelationPack } from './correlationAdvanced'

export type AutomatedInference = {
  /** One short paragraph for clinicians / researchers */
  summary: string
  /** Ranked interpretive hypotheses (statistical + pilot context, not diagnoses) */
  leadHypotheses: string[]
  /** Heuristic 0–1 “strength of physical–emotional structure” from |r|, matrix peaks, lag structure */
  coherenceScore: number
  caveats: string[]
}

function maxMatrixEntry(matrix: EmotionPhysRow[]): { emotion: string; channel: string; r: number } | null {
  let best: { emotion: string; channel: string; r: number } | null = null
  for (const row of matrix) {
    const cells: [string, number | null][] = [
      ['HR', row.rHeartRate],
      ['RMSSD', row.rHrvRmssd],
      ['Focus', row.rFocusIndex],
    ]
    for (const [ch, r] of cells) {
      if (r == null) continue
      if (!best || Math.abs(r) > Math.abs(best.r)) best = { emotion: row.emotion, channel: ch, r }
    }
  }
  return best
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs: number[]) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

/**
 * Rule-based “AI-style” narrative from correlation structure (on-device; no external LLM).
 * Framed as hypotheses for human review.
 */
export function generateAutomatedInferences(
  pack: SessionCorrelationPack,
  analysis: CaseAnalysis,
): AutomatedInference {
  const caveats = ['Rule-based stats only — not diagnosis.', 'Pilot data — confirm across sessions.']

  const { zeroLagR, bestLag, matrix, rolling, ols } = pack
  const m = analysis.metrics
  const hypotheses: string[] = []

  const peakCell = maxMatrixEntry(matrix)
  if (peakCell && Math.abs(peakCell.r) >= 0.2) {
    const dir = peakCell.r > 0 ? 'tends to rise with' : 'tends to move inversely to'
    hypotheses.push(
      `Physical–emotional matrix peak: ${peakCell.emotion} vs ${peakCell.channel} (r≈${peakCell.r.toFixed(2)}); ${dir} that physical channel (correlational).`,
    )
  }

  if (bestLag && zeroLagR != null && bestLag.r != null) {
    const improved = Math.abs(bestLag.r) > Math.abs(zeroLagR) + 0.05
    if (improved && bestLag.lagSteps !== 0) {
      const lead =
        bestLag.lagSteps > 0
          ? `Emotional valence leads physical RMSSD by ~${Math.abs(bestLag.lagMs)} ms (stronger r than 0-lag).`
          : `Physical RMSSD leads emotional valence by ~${Math.abs(bestLag.lagMs)} ms (stronger r than 0-lag).`
      hypotheses.push(lead)
    } else if (Math.abs(zeroLagR) >= 0.25) {
      hypotheses.push(`Zero-lag emotional valence vs physical RMSSD: r≈${zeroLagR.toFixed(2)}.`)
    }
  }

  const rollingRs = rolling.map((x) => x.r).filter((x): x is number => x != null && !Number.isNaN(x))
  if (rollingRs.length >= 5) {
    const vol = std(rollingRs)
    if (vol > 0.35) {
      hypotheses.push(`Rolling emotional–physical r (valence vs RMSSD) volatile (σ≈${vol.toFixed(2)}) — check by segment.`)
    } else if (vol < 0.12 && rollingRs.length > 0) {
      hypotheses.push('Rolling emotional–physical r (valence vs RMSSD) fairly stable mid-session.')
    }
  }

  if (ols && ols.r2 >= 0.15) {
    hypotheses.push(
      `OLS emotional valence → physical RMSSD R²≈${(ols.r2 * 100).toFixed(0)}%; slope ${ols.slope > 0 ? '+' : '−'} (in-range only).`,
    )
  }

  if (m.pctStressedAutonomic != null && m.pctStressedAutonomic > 35 && m.meanValence != null && m.meanValence < 0) {
    hypotheses.push('Many “Stressed” labels with negative mean valence — check task/posture.')
  }

  if (hypotheses.length === 0) {
    hypotheses.push('No strong linear physical–emotional pattern in this fit.')
  }

  const matStrength = peakCell ? Math.min(1, Math.abs(peakCell.r)) : 0
  const lagStrength = bestLag?.r != null ? Math.min(1, Math.abs(bestLag.r)) : 0
  const r0 = zeroLagR != null ? Math.abs(zeroLagR) : 0
  const coherenceScore = Math.min(
    1,
    0.25 + 0.35 * r0 + 0.25 * matStrength + 0.15 * lagStrength,
  )

  const summaryParts: string[] = []
  if (zeroLagR != null) {
    summaryParts.push(`Emotional valence vs physical RMSSD @0 lag: r≈${zeroLagR.toFixed(2)} (${zeroLagR >= 0 ? '+' : '−'}).`)
  }
  if (peakCell) {
    summaryParts.push(`Strongest emotional→physical matrix pair: ${peakCell.emotion} / ${peakCell.channel}.`)
  }
  if (bestLag && bestLag.lagSteps !== 0 && bestLag.r != null && zeroLagR != null && Math.abs(bestLag.r) > Math.abs(zeroLagR)) {
    summaryParts.push(`Lag ${bestLag.lagMs} ms improves linear fit vs 0-lag.`)
  }
  const summary =
    summaryParts.join(' ') ||
    'Weak or ambiguous physical–emotional linear structure — use raw traces.'

  return {
    summary,
    leadHypotheses: hypotheses,
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    caveats,
  }
}
