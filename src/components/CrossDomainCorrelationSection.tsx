import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { analyzeSession } from '../lib/caseAnalytics'
import {
  buildAlignedSeriesBundle,
  buildSessionCorrelationPack,
  computeModeCorrelation,
  inferPhysicalDomain,
} from '../lib/correlationAdvanced'
import { generateAutomatedInferences } from '../lib/inferenceEngine'
import type {
  CorrMethod,
  CorrMode,
  EmotionPhysRow,
  FullCrossSeriesCorrelation,
  ModeCorrelationResult,
} from '../lib/correlationAdvanced'
import type { SessionRecord } from '../types/mindpulseExport'

type Props = {
  session: SessionRecord
}

export function CrossDomainCorrelationSection({ session }: Props) {
  const [mode, setMode] = useState<CorrMode>('emotion_physical')
  const [method, setMethod] = useState<CorrMethod>('pearson')
  const pack = useMemo(() => buildSessionCorrelationPack(session, 400, method), [session, method])
  const analysis = useMemo(() => analyzeSession(session), [session])
  const inference = useMemo(() => generateAutomatedInferences(pack, analysis), [pack, analysis])
  const bundle = useMemo(
    () => buildAlignedSeriesBundle(session.emotionTimeSeries, session.physicalTimeSeries, 400),
    [session],
  )
  const modeMatrix = useMemo(() => computeModeCorrelation(bundle, mode, method), [bundle, mode, method])

  const { grid, matrix, fullMatrix, lagged, rolling, ols } = pack

  if (grid.length < 4) {
    return (
      <section className="mp-card">
        <h2 className="mp-card__title">Physical–emotional correlation</h2>
        <p className="mp-chart-empty">Not enough aligned samples for lag, rolling, or matrix analysis.</p>
      </section>
    )
  }

  return (
    <section className="mp-card mp-cross-domain">
      <h2 className="mp-card__title">Physical–emotional correlation</h2>
      <p className="mp-card__desc">
        Primary analysis: emotional time series vs wearable physical channels on a common timeline. Optional modes
        below compare channels within one domain for context.
      </p>

      <p className="mp-corr-controls-hint mp-text-muted">
        Mode changes the <strong>mode map</strong> rows/columns (which channel families are compared). Method (
        {method === 'pearson' ? 'Pearson' : 'Spearman'}) applies to <strong>all</strong> numeric r tables and lag /
        rolling summaries below.
      </p>

      <div className="mp-corr-controls" role="group" aria-label="Physical–emotional correlation controls">
        <div className="mp-corr-controls__row">
          <label htmlFor="corr-mode">Mode</label>
          <select id="corr-mode" value={mode} onChange={(e) => setMode(e.target.value as CorrMode)}>
            <option value="emotion_physical">Emotional vs physical (primary)</option>
            <option value="physical_physical">Physical vs physical (context)</option>
            <option value="emotion_emotion">Emotional vs emotional (context)</option>
          </select>
        </div>
        <div className="mp-corr-controls__row">
          <label htmlFor="corr-method">Method</label>
          <select
            id="corr-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as CorrMethod)}
          >
            <option value="pearson">Pearson (linear)</option>
            <option value="spearman">Spearman (rank)</option>
          </select>
        </div>
      </div>

      <div className="mp-inference-panel">
        <div className="mp-inference-panel__head">
          <h3 className="mp-inference-panel__title">Automated inference (physical–emotional)</h3>
          <span className="mp-inference-score" title="Interpretive confidence layer">
            Confidence: {inference.coherenceScore >= 0.6 ? 'Medium' : 'Low'}
          </span>
        </div>
        <p className="mp-inference-summary">{inference.summary}</p>
        <ol className="mp-inference-list">
          {inference.leadHypotheses.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
        <ul className="mp-inference-caveats">
          {inference.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      <details className="mp-subsection-collapsible">
        <summary>Charts and matrices (physical–emotional)</summary>
        <div className="mp-cross-grid">
          <ModeCorrelationMatrix key={`mode-${mode}-${method}`} matrix={modeMatrix} />
          <CorrelationSpectrum key={`spec-${mode}-${method}`} matrix={modeMatrix} />
          <ValenceHrvScatter key={`scatter-${method}`} grid={grid} ols={ols} method={method} />
          <LaggedCorrelationChart key={`lag-${method}`} lagged={lagged} method={method} />
          <RollingCorrelationChart key={`roll-${method}`} rolling={rolling} method={method} />
          <EmotionPhysiologyMatrix key={`emo-${method}`} matrix={matrix} method={method} />
          <FullCrossSeriesMatrix key={`full-${method}`} matrix={fullMatrix} method={method} />
        </div>
      </details>
    </section>
  )
}

function ModeCorrelationMatrix({ matrix }: { matrix: ModeCorrelationResult }) {
  if (matrix.colKeys.length === 0 || matrix.rowKeys.length === 0) {
    return (
      <figure className="mp-fig mp-fig--wide">
        <figcaption className="mp-fig__cap">Mode-based physical–emotional correlation map</figcaption>
        <p className="mp-fig__note">Insufficient channels for selected mode.</p>
      </figure>
    )
  }
  return (
    <figure className="mp-fig mp-fig--wide">
      <figcaption className="mp-fig__cap">
        {matrix.mode === 'emotion_physical'
          ? 'Physical–emotional mode map'
          : 'Mode map'}{' '}
        ({matrix.mode.replace('_', ' / ')}, {matrix.method}) · {matrix.alignedSamples} aligned samples
      </figcaption>
      <div className="mp-matrix-wrap">
        <table className="mp-matrix mp-matrix--session" role="grid">
          <thead>
            <tr>
              <th className="mp-matrix__corner" />
              {matrix.colKeys.map((k) => (
                <th key={k} className="mp-matrix__head">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rowKeys.map((rk, i) => (
              <tr key={rk}>
                <th className="mp-matrix__head">{rk}</th>
                {matrix.values[i]!.map((v, j) => (
                  <td key={`${rk}-${matrix.colKeys[j]}`} className="mp-matrix__cell" style={cellHeat(v)}>
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function CorrelationSpectrum({ matrix }: { matrix: ModeCorrelationResult }) {
  const top = useMemo(() => {
    const items: Array<{ pair: string; r: number; domain: string }> = []
    for (let i = 0; i < matrix.rowKeys.length; i++) {
      for (let j = 0; j < matrix.colKeys.length; j++) {
        const rk = matrix.rowKeys[i]!
        const ck = matrix.colKeys[j]!
        if (matrix.mode !== 'emotion_physical' && rk === ck) continue
        const r = matrix.values[i]![j]
        if (r == null) continue
        const pairKey = `${rk}|${ck}`
        const rev = `${ck}|${rk}`
        if (items.some((x) => x.pair === rev)) continue
        const domain = `${inferPhysicalDomain(rk)} · ${inferPhysicalDomain(ck)}`
        items.push({ pair: pairKey, r, domain })
      }
    }
    return items.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 10)
  }, [matrix])

  const W = 820
  const H = 230
  const padL = 26
  const padR = 12
  const padT = 16
  const padB = 24
  const maxAbs = Math.max(0.15, ...top.map((t) => Math.abs(t.r)))
  const innerW = W - padL - padR
  const step = top.length ? innerW / top.length : innerW
  const midY = (H - padT - padB) / 2 + padT

  return (
    <figure className="mp-fig mp-fig--wide">
      <figcaption className="mp-fig__cap">
        Physical–emotional correlation spectrum (top |r| pairs, {matrix.method})
      </figcaption>
      {top.length === 0 ? (
        <p className="mp-fig__note">No valid pairwise correlations for selected mode.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mp-fig__svg">
            <rect width={W} height={H} fill="var(--mp-bg-chart)" rx="4" />
            <line x1={padL} y1={midY} x2={W - padR} y2={midY} stroke="var(--mp-border)" strokeWidth="0.7" />
            {top.map((item, idx) => {
              const bw = Math.max(8, step - 5)
              const x = padL + idx * step + (step - bw) / 2
              const h = (Math.abs(item.r) / maxAbs) * (midY - padT - 4)
              const y = item.r >= 0 ? midY - h : midY
              const color = item.r >= 0 ? 'var(--mp-accent-sci)' : 'var(--mp-accent-psy-muted)'
              return <rect key={item.pair} x={x} y={y} width={bw} height={h} fill={color} opacity="0.92" rx="1" />
            })}
          </svg>
          <ul className="mp-fig-list">
            {top.slice(0, 6).map((item) => {
              const [a, b] = item.pair.split('|')
              return (
                <li key={item.pair}>
                  <span className="mp-mono-inline">{a}</span> ↔ <span className="mp-mono-inline">{b}</span>:{' '}
                  {item.r.toFixed(3)} <span className="mp-fig-list__domain">({item.domain})</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </figure>
  )
}

function FullCrossSeriesMatrix({ matrix, method }: { matrix: FullCrossSeriesCorrelation; method: CorrMethod }) {
  if (matrix.physicalKeys.length === 0) {
    return (
      <figure className="mp-fig mp-fig--wide">
        <figcaption className="mp-fig__cap">Full map: emotional channels × physical numeric fields</figcaption>
        <p className="mp-fig__note">No numeric physical fields found for this case.</p>
      </figure>
    )
  }

  const mLabel = method === 'pearson' ? 'Pearson' : 'Spearman'
  return (
    <figure className="mp-fig mp-fig--wide">
      <figcaption className="mp-fig__cap">
        Full physical–emotional map ({mLabel} r): every emotional channel vs every numeric physical channel (aligned
        samples: {matrix.alignedSamples})
      </figcaption>
      <div className="mp-matrix-wrap">
        <table className="mp-matrix mp-matrix--session" role="grid">
          <thead>
            <tr>
              <th className="mp-matrix__corner" />
              {matrix.physicalKeys.map((k) => (
                <th key={k} className="mp-matrix__head">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.emotionKeys.map((ek, rowIdx) => (
              <tr key={ek}>
                <th scope="row" className="mp-matrix__head">
                  {ek}
                </th>
                {matrix.values[rowIdx]!.map((v, colIdx) => (
                  <td key={`${ek}-${matrix.physicalKeys[colIdx]}`} className="mp-matrix__cell" style={cellHeat(v)}>
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mp-fig__note">
        {mLabel} r per emotional–physical pair. Near +1/−1 implies stronger association (linear for Pearson, rank-based
        for Spearman); interpret with sample density and sensor quality.
      </p>
    </figure>
  )
}

function ValenceHrvScatter({
  grid,
  ols,
  method,
}: {
  grid: { valence: number; hrvRmssd: number }[]
  ols: { slope: number; intercept: number; r2: number } | null
  method: CorrMethod
}) {
  const W = 380
  const H = 220
  const pad = 36
  const vx = grid.map((g) => g.valence)
  const vy = grid.map((g) => g.hrvRmssd)
  const minX = Math.min(...vx) - 0.05
  const maxX = Math.max(...vx) + 0.05
  const minY = Math.min(...vy) - 2
  const maxY = Math.max(...vy) + 2
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad)
  const sy = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad)

  let linePts = ''
  if (ols) {
    const x1 = minX
    const x2 = maxX
    const y1 = ols.intercept + ols.slope * x1
    const y2 = ols.intercept + ols.slope * x2
    linePts = `${sx(x1).toFixed(1)},${sy(y1).toFixed(1)} ${sx(x2).toFixed(1)},${sy(y2).toFixed(1)}`
  }

  const mLabel = method === 'pearson' ? 'Pearson' : 'Spearman'
  return (
    <figure className="mp-fig">
      <figcaption className="mp-fig__cap">
        Emotional valence vs physical RMSSD — scatter ({mLabel} context for r in other panels; OLS line is linear fit)
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mp-fig__svg">
        <rect width={W} height={H} fill="var(--mp-bg-chart)" rx="4" />
        {linePts ? (
          <polyline
            fill="none"
            stroke="var(--mp-accent-psy)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            points={linePts}
          />
        ) : null}
        {grid.map((g, i) => (
          <circle key={i} cx={sx(g.valence)} cy={sy(g.hrvRmssd)} r="3" fill="var(--mp-accent-cyan)" opacity="0.85" />
        ))}
      </svg>
      {ols ? (
        <p className="mp-fig__note mp-mono-inline">
          OLS RMSSD ~ valence · R² = {ols.r2.toFixed(2)} · slope = {ols.slope.toFixed(1)} ms/unit
        </p>
      ) : null}
    </figure>
  )
}

function LaggedCorrelationChart({ lagged, method }: { lagged: { lagMs: number; r: number | null }[]; method: CorrMethod }) {
  const W = 380
  const H = 220
  const pad = 28
  const maxAbs = Math.max(0.15, ...lagged.map((l) => (l.r != null ? Math.abs(l.r) : 0)))
  const midY = (H - 2 * pad) / 2 + pad
  const barW = (W - 2 * pad) / lagged.length - 2

  const mLabel = method === 'pearson' ? 'Pearson' : 'Spearman'
  return (
    <figure className="mp-fig">
      <figcaption className="mp-fig__cap">Lead–lag r ({mLabel}): emotional valence vs physical RMSSD</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mp-fig__svg">
        <rect width={W} height={H} fill="var(--mp-bg-chart)" rx="4" />
        <line x1={pad} y1={midY} x2={W - pad} y2={midY} stroke="var(--mp-border)" strokeWidth="0.75" />
        {lagged.map((L, i) => {
          if (L.r == null) return null
          const x = pad + (i / (lagged.length - 1 || 1)) * (W - 2 * pad) - barW / 2
          const h = (Math.abs(L.r) / maxAbs) * (midY - pad - 6)
          const y = L.r >= 0 ? midY - h : midY
          const fill = L.r >= 0 ? 'var(--mp-accent-sci)' : 'var(--mp-accent-psy-muted)'
          return <rect key={L.lagMs} x={x} y={y} width={barW} height={h} fill={fill} opacity="0.9" rx="1" />
        })}
      </svg>
      <p className="mp-fig__note">
        Negative lag ms: physical HRV leads emotional valence · Positive: emotional valence leads physical HRV
      </p>
    </figure>
  )
}

function RollingCorrelationChart({
  rolling,
  method,
}: {
  rolling: { sessionTimeMs: number; r: number | null }[]
  method: CorrMethod
}) {
  const W = 380
  const H = 200
  const pad = 32
  const valid = rolling.filter((x): x is { sessionTimeMs: number; r: number } => x.r != null)
  if (valid.length < 2) {
    return (
      <figure className="mp-fig">
        <figcaption className="mp-fig__cap">
          Rolling r ({method === 'pearson' ? 'Pearson' : 'Spearman'}) — valence vs RMSSD (8-point window)
        </figcaption>
        <p className="mp-fig__note">Insufficient windows.</p>
      </figure>
    )
  }
  const maxT = valid[valid.length - 1]!.sessionTimeMs
  const minR = Math.min(-0.5, ...valid.map((v) => v.r))
  const maxR = Math.max(0.5, ...valid.map((v) => v.r))
  const sx = (t: number) => pad + (t / maxT) * (W - 2 * pad)
  const sy = (r: number) => H - pad - ((r - minR) / (maxR - minR || 1)) * (H - 2 * pad)
  const pts = valid.map((v) => `${sx(v.sessionTimeMs).toFixed(1)},${sy(v.r).toFixed(1)}`).join(' ')

  const mLabel = method === 'pearson' ? 'Pearson' : 'Spearman'
  return (
    <figure className="mp-fig">
      <figcaption className="mp-fig__cap">Rolling {mLabel} r: emotional valence vs physical RMSSD (8 aligned steps)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mp-fig__svg">
        <rect width={W} height={H} fill="var(--mp-bg-chart)" rx="4" />
        <line
          x1={pad}
          y1={sy(0)}
          x2={W - pad}
          y2={sy(0)}
          stroke="var(--mp-border)"
          strokeDasharray="3 3"
          strokeWidth="0.6"
        />
        <polyline fill="none" stroke="var(--mp-amber)" strokeWidth="1.75" points={pts} />
      </svg>
    </figure>
  )
}

function EmotionPhysiologyMatrix({ matrix, method }: { matrix: EmotionPhysRow[]; method: CorrMethod }) {
  const mLabel = method === 'pearson' ? 'Pearson' : 'Spearman'
  return (
    <figure className="mp-fig mp-fig--wide">
      <figcaption className="mp-fig__cap">
        {mLabel} r: each emotional expression dimension vs physical HR, RMSSD, and focus index (aligned grid)
      </figcaption>
      <div className="mp-matrix-wrap">
        <table className="mp-matrix mp-matrix--session" role="grid">
          <thead>
            <tr>
              <th className="mp-matrix__corner" />
              <th className="mp-matrix__head">HR</th>
              <th className="mp-matrix__head">RMSSD</th>
              <th className="mp-matrix__head">Focus</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.emotion}>
                <th scope="row" className="mp-matrix__head">
                  {row.emotion}
                </th>
                <td className="mp-matrix__cell" style={cellHeat(row.rHeartRate)}>
                  {fmt(row.rHeartRate)}
                </td>
                <td className="mp-matrix__cell" style={cellHeat(row.rHrvRmssd)}>
                  {fmt(row.rHrvRmssd)}
                </td>
                <td className="mp-matrix__cell" style={cellHeat(row.rFocusIndex)}>
                  {fmt(row.rFocusIndex)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function fmt(r: number | null) {
  return r == null ? '—' : r.toFixed(2)
}

function cellHeat(r: number | null): CSSProperties {
  if (r == null) return { background: 'var(--mp-bg-deep)', color: 'var(--mp-text-dim)' }
  const t = (r + 1) / 2
  const red = Math.round(22 + (1 - t) * 55)
  const green = Math.round(38 + t * 75)
  const blue = Math.round(52 + t * 95)
  return {
    background: `rgb(${red},${green},${blue})`,
    color: t > 0.55 ? '#e8ecf0' : '#aeb8c4',
  }
}
