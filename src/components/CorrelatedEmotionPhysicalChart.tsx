import { useMemo } from 'react'
import { buildAlignedSeries } from '../lib/caseAnalytics'
import type { EmotionTimePoint, PhysicalTimePoint } from '../types/mindpulseExport'

type Props = {
  emotion: EmotionTimePoint[] | undefined
  physical: PhysicalTimePoint[] | undefined
}

const W = 880
const H = 360
const PAD_L = 52
const PAD_R = 52
const PAD_T = 28
const PAD_B = 36
const SPLIT = 12
const TOP_H = 130
const BOT_H = 130

export function CorrelatedEmotionPhysicalChart({ emotion, physical }: Props) {
  const aligned = useMemo(() => buildAlignedSeries(emotion, physical, 400), [emotion, physical])

  const paths = useMemo(() => {
    if (!aligned.length) return null

    const maxT = aligned[aligned.length - 1]!.sessionTimeMs
    const innerW = W - PAD_L - PAD_R
    const sx = (t: number) => PAD_L + (t / maxT) * innerW

    const topY = (v: number) => PAD_T + TOP_H / 2 - (v / 1) * (TOP_H / 2 - 8)
    const valencePts = aligned.map((a) => `${sx(a.sessionTimeMs).toFixed(1)},${topY(a.valence).toFixed(1)}`).join(' ')

    const hrVals = aligned.map((a) => a.heartRate)
    const hrvVals = aligned.map((a) => a.hrvRmssd)
    const minHr = Math.min(...hrVals) - 2
    const maxHr = Math.max(...hrVals) + 2
    const minHrv = Math.min(...hrvVals) - 2
    const maxHrv = Math.max(...hrvVals) + 2

    const botTop = PAD_T + TOP_H + SPLIT
    const yHr = (hr: number) =>
      botTop + BOT_H - ((hr - minHr) / (maxHr - minHr || 1)) * (BOT_H - 16)
    const yHrv = (hrv: number) =>
      botTop + BOT_H - ((hrv - minHrv) / (maxHrv - minHrv || 1)) * (BOT_H - 16)

    const hrPts = aligned.map((a) => `${sx(a.sessionTimeMs).toFixed(1)},${yHr(a.heartRate).toFixed(1)}`).join(' ')
    const hrvPts = aligned.map((a) => `${sx(a.sessionTimeMs).toFixed(1)},${yHrv(a.hrvRmssd).toFixed(1)}`).join(' ')

    return {
      maxT,
      valencePts,
      hrPts,
      hrvPts,
      minHr,
      maxHr,
      minHrv,
      maxHrv,
      sx,
      topY,
      botTop,
      yHr,
      yHrv,
    }
  }, [aligned])

  if (!paths || !aligned.length) {
    return (
      <p className="mp-chart-empty">
        No overlapping emotional and physical samples to plot. Check session payload.
      </p>
    )
  }

  const { maxT, valencePts, hrPts, hrvPts, minHr, maxHr, minHrv, maxHrv, sx, topY, botTop } = paths

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    x: sx(f * maxT),
    label: `${((f * maxT) / 1000).toFixed(1)}s`,
  }))

  return (
    <figure className="mp-correlated-chart">
      <figcaption className="mp-correlated-chart__cap">
        <strong>Physical–emotional alignment</strong>
        <span className="mp-correlated-chart__sub">
          Top: emotional valence proxy from expression probabilities (400 ms hold-last-value alignment). Bottom:
          physical HR and RMSSD on the same timeline (independent vertical scales).
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mp-correlated-chart__svg" role="img" aria-label="Physical and emotional time series">
        <rect width={W} height={H} fill="var(--mp-bg-chart)" rx="4" />

        {/* Top panel frame */}
        <text x={PAD_L} y={PAD_T - 8} fill="var(--mp-text-dim)" fontSize="11" fontFamily="var(--mp-mono)">
          Emotional valence
        </text>
        <line
          x1={PAD_L}
          y1={topY(0)}
          x2={W - PAD_R}
          y2={topY(0)}
          stroke="var(--mp-border)"
          strokeDasharray="4 3"
          strokeWidth="0.75"
        />
        <polyline fill="none" stroke="var(--mp-accent-psy)" strokeWidth="1.75" points={valencePts} />

        {/* Bottom panel */}
        <text x={PAD_L} y={botTop - 6} fill="var(--mp-text-dim)" fontSize="11" fontFamily="var(--mp-mono)">
          Heart rate & HRV (RMSSD)
        </text>
        <polyline fill="none" stroke="var(--mp-accent-sci)" strokeWidth="1.75" points={hrvPts} />
        <polyline fill="none" stroke="#7a9e8e" strokeWidth="1.25" strokeDasharray="5 3" points={hrPts} />

        {/* X ticks */}
        {xTicks.map((t) => (
          <g key={t.label}>
            <line
              x1={t.x}
              y1={PAD_T}
              x2={t.x}
              y2={H - PAD_B}
              stroke="var(--mp-border)"
              strokeWidth="0.5"
              opacity="0.35"
            />
            <text x={t.x} y={H - 10} textAnchor="middle" fill="var(--mp-text-dim)" fontSize="10" fontFamily="var(--mp-mono)">
              {t.label}
            </text>
          </g>
        ))}

        <text x={W - PAD_R} y={PAD_T + TOP_H - 4} textAnchor="end" fill="var(--mp-text-muted)" fontSize="10" fontFamily="var(--mp-mono)">
          + affect −
        </text>
        <text x={PAD_L} y={botTop + BOT_H - 4} fill="var(--mp-accent-sci)" fontSize="10" fontFamily="var(--mp-mono)">
          RMSSD {minHrv.toFixed(0)}–{maxHrv.toFixed(0)} ms
        </text>
        <text x={W - PAD_R} y={botTop + BOT_H - 4} textAnchor="end" fill="#7a9e8e" fontSize="10" fontFamily="var(--mp-mono)">
          HR {minHr.toFixed(0)}–{maxHr.toFixed(0)} bpm
        </text>
      </svg>
      <ul className="mp-correlated-chart__legend">
        <li>
          <span className="mp-leg-dot mp-leg-dot--psy" /> Emotional valence (expression-derived)
        </li>
        <li>
          <span className="mp-leg-dot mp-leg-dot--sci" /> RMSSD
        </li>
        <li>
          <span className="mp-leg-dot mp-leg-dot--hr" /> Heart rate
        </li>
      </ul>
    </figure>
  )
}
