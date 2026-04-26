import { useMemo } from 'react'
import { analyzeCaseDeep, WINDOWED_EMOTION_FEATURE_KEYS } from '../lib/advancedCaseAnalysis'
import { buildAlignedSeries } from '../lib/caseAnalytics'
import type { SessionRecord } from '../types/mindpulseExport'

export function AdvancedCaseAnalysisSection({ session }: { session: SessionRecord }) {
  const deep = useMemo(() => analyzeCaseDeep(session, 500), [session])
  const aligned = useMemo(
    () => buildAlignedSeries(session.emotionTimeSeries, session.physicalTimeSeries, 400),
    [session],
  )

  return (
    <section className="mp-card mp-analysis-stack">
      <h2 className="mp-card__title">Physical–emotional case analysis</h2>
      <p className="mp-card__desc">
        This session is analyzed as emotional parameters (expression-derived scores) against physical parameters from
        the wearable (HR, HRV, focus, SpO₂, etc.).
      </p>

      <div className="mp-card mp-insight-first">
        <h3 className="mp-subtitle">Summary</h3>
        <p className="mp-analysis-headline">{deep.finalInsight.primary_finding}</p>
        <ul className="mp-bullet-list">
          {deep.finalInsight.supporting_points.slice(0, 3).map((x) => (
            <li key={x}>{x}</li>
          ))}
          <li>{deep.mlInference.narrative}</li>
        </ul>
        <p className="mp-text-muted">Confidence: {deep.finalInsight.confidence}</p>
        <div className="mp-metrics-grid">
          <div className="mp-metric-cell">
            <div className="mp-metric-cell__label">Emotional parameter variance</div>
            <div className="mp-metric-cell__value">{deep.finalInsight.validity_flags.emotion_variance}</div>
          </div>
          <div className="mp-metric-cell">
            <div className="mp-metric-cell__label">Physical parameter variance</div>
            <div className="mp-metric-cell__value">{deep.finalInsight.validity_flags.physio_variance}</div>
          </div>
          <div className="mp-metric-cell">
            <div className="mp-metric-cell__label">Data quality score</div>
            <div className="mp-metric-cell__value">{deep.finalInsight.validity_flags.sensor_quality}/100</div>
          </div>
          <div className="mp-metric-cell">
            <div className="mp-metric-cell__label">ML model quality</div>
            <div className="mp-metric-cell__value">
              {deep.mlInference.modelQuality}
              {deep.mlInference.fitR2 != null ? ` (R2 ${deep.mlInference.fitR2.toFixed(3)})` : ''}
            </div>
          </div>
          <div className="mp-metric-cell">
            <div className="mp-metric-cell__label">Estimated stress probability</div>
            <div className="mp-metric-cell__value">
              {deep.mlInference.stressProbability != null ? `${(deep.mlInference.stressProbability * 100).toFixed(1)}%` : 'n/a'}
            </div>
          </div>
        </div>
      </div>

      <section className="mp-subsection">
        <h3 className="mp-subtitle">Physical–emotional lag</h3>
        <div className="mp-event-cards">
          {deep.temporalCausality.topRelationships.length === 0 ? (
            <p className="mp-text-muted">No pairs with |r| ≥ 0.2.</p>
          ) : (
            deep.temporalCausality.topRelationships.slice(0, 2).map((x) => (
              <article key={x.label} className="mp-card">
                <h4 className="mp-subtitle">{humanizeRelationshipLabel(x.label)}</h4>
                <p>
                  Lag {x.bestLagMs} ms · r {x.bestR != null ? x.bestR.toFixed(3) : '—'} ({x.confidence}) · lead:{' '}
                  {x.bestLagMs < 0 ? 'physical' : 'emotional'}
                </p>
              </article>
            ))
          )}
        </div>
        <p className="mp-text-muted">Directionality: {deep.temporalCausality.directionality}</p>
      </section>

      <section className="mp-subsection">
        <h3 className="mp-subtitle">Events</h3>
        {deep.events.length === 0 ? (
          <p className="mp-text-muted">No detected events.</p>
        ) : (
          <div className="mp-event-cards">
            {deep.events.map((e, i) => (
              <article key={`${e.type}-${e.tMs}-${i}`} className="mp-card mp-event-card">
                <h4 className="mp-subtitle">Event @{(e.tMs / 1000).toFixed(1)}s</h4>
                <p className="mp-event-card__label">Physical & emotional signals</p>
                <div className="mp-event-chip-row" aria-label="Detected signal phrases">
                  {splitEventTriggers(e.type).map((phrase, ti) => (
                    <span key={`${e.tMs}-${ti}-${phrase}`} className={`mp-event-chip ${eventChipTone(phrase)}`}>
                      {phrase}
                    </span>
                  ))}
                </div>
                <p>
                  <span className="mp-event-card__label">Dominant expression</span>{' '}
                  {e.before} → {e.during} → {e.after}
                </p>
                <p className="mp-text-muted">
                  Lag ~{(e.lagMs / 1000).toFixed(1)}s · Confidence {e.confidence}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mp-subsection mp-two-col">
        <div className="mp-card">
          <h3 className="mp-subtitle">States</h3>
          <ul className="mp-bullet-list">
            <li>
              Physical state: {deep.stateDynamics.dominantPhysical} ({deep.stateDynamics.physicalPersistencePct.toFixed(1)}% persistence)
            </li>
            <li>
              Emotional state: {deep.stateDynamics.dominantEmotional} ({deep.stateDynamics.emotionalPersistencePct.toFixed(1)}% persistence)
            </li>
            <li>{deep.stateDynamics.interpretation}</li>
          </ul>
        </div>

        <div className="mp-card">
          <h3 className="mp-subtitle">Evidence</h3>
          <ul className="mp-bullet-list">
            {deep.evidenceFindings.slice(0, 3).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mp-subsection mp-subsection--timeline">
        <h3 className="mp-subtitle">Timeline</h3>
        <MultiLayerTimeline
          aligned={aligned}
          events={deep.events}
          topRelation={deep.temporalCausality.topRelationships[0]?.label ?? null}
          topLagMs={deep.temporalCausality.topRelationships[0]?.bestLagMs ?? null}
        />
      </section>

      <details className="mp-subsection-collapsible">
        <summary>Diagnostics (physical–emotional linkage)</summary>
        <p className="mp-text-muted mp-reports-diag-intro">
          Summaries below support the same question: whether emotional trajectories move with physical signals (and
          how strongly).
        </p>
        <ul className="mp-bullet-list">
          {deep.interpretationLayer.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <section className="mp-subsection mp-two-col">
          <MatrixCard title="Physical state transitions" tm={deep.physicalTransitions} />
          <MatrixCard title="Emotional state transitions" tm={deep.emotionalTransitions} />
        </section>
      </details>

      <details className="mp-subsection-collapsible">
        <summary>Physical–emotional correlation (3s windows)</summary>
        <p className="mp-text-muted mp-reports-diag-intro">
          Each cell is correlation between two window-smoothed series (3s). Rows/columns include emotional parameters
          (valence, negative score, expression entropy and intensity, and each expression channel) plus every numeric
          physical field observed in this session (HRV, HR, focus, SpO₂, BP, temperature, etc.). Off-diagonal
          emotional-vs-physical blocks are the primary cross-couplings. Open each block to scroll the full matrix; row
          and column headers stay pinned.
        </p>
        <div className="mp-corr-matrices-stack">
          <details className="mp-corr-matrix-details" open>
            <summary>Pearson r — emotional vs physical parameters (3s windows)</summary>
            <CorrMatrixCard kind="pearson" corr={deep.pearsonWindow} variant="stacked" />
          </details>
          <details className="mp-corr-matrix-details">
            <summary>Spearman r — emotional vs physical parameters (3s windows)</summary>
            <CorrMatrixCard kind="spearman" corr={deep.spearmanWindow} variant="stacked" />
          </details>
        </div>
      </details>
    </section>
  )
}

function humanizeRelationshipLabel(label: string) {
  const [leftRaw, rightRaw] = label.split('→').map((x) => x.trim())
  const left = humanizeMetricToken(leftRaw)
  const right = humanizeMetricToken(rightRaw)
  return `${left} → ${right}`
}

function humanizeMetricToken(token: string) {
  const t = token.toLowerCase()
  if (t === 'hrvrmssd') return 'HRV (RMSSD)'
  if (t === 'heartrate') return 'Heart rate'
  if (t === 'focusindex') return 'Focus index'
  if (t === 'restingheartrate') return 'Resting heart rate'
  if (t === 'spo2') return 'SpO2'
  if (t === 'autonomicconfidence') return 'Autonomic confidence'
  if (t === 'caloriesactive') return 'Active calories'
  if (t === 'systolic') return 'Systolic blood pressure'
  if (t === 'diastolic') return 'Diastolic blood pressure'
  if (t === 'neutral') return 'Neutral expression'
  if (t === 'happy') return 'Happiness expression'
  if (t === 'sadness') return 'Sadness expression'
  if (t === 'anger') return 'Anger expression'
  if (t === 'fear') return 'Fear expression'
  if (t === 'disgust') return 'Disgust expression'
  if (t === 'surprise') return 'Surprise expression'
  if (t === 'negative emotion score') return 'Negative emotion burden'
  if (t === 'valence') return 'Valence trend'
  if (t === 'negativescore') return 'Negative score'
  if (t === 'entropy') return 'Expression entropy'
  if (t === 'intensity') return 'Expression intensity'
  if (t === 'bodytempc') return 'Body temp (°C)'
  return token
}

function professionalPhysicalLabel(token: string) {
  const t = token.toLowerCase()
  if (t === 'hrvrmssd') return 'HRV RMSSD (ms)'
  if (t === 'heartrate') return 'Heart Rate (bpm)'
  if (t === 'restingheartrate') return 'Resting HR (bpm)'
  if (t === 'focusindex') return 'Focus Index (0-100)'
  if (t === 'spo2') return 'SpO2 (%)'
  if (t === 'systolic') return 'Systolic BP (mmHg)'
  if (t === 'diastolic') return 'Diastolic BP (mmHg)'
  if (t === 'autonomicconfidence') return 'Autonomic Confidence (%)'
  if (t === 'caloriesactive') return 'Active Calories (kcal)'
  return humanizeMetricToken(token)
}

/** One-line helper shown under each physical channel in “Channel mapping details”. */
function physicalChannelOneLiner(token: string): string {
  const t = token.toLowerCase()
  if (t === 'hrvrmssd')
    return 'Beat-to-beat interval variability (RMSSD) in ms; higher values often suggest calmer parasympathetic tone when read in clinical context.'
  if (t === 'heartrate')
    return 'Instantaneous heart rate from the wearable, in beats per minute.'
  if (t === 'restingheartrate')
    return 'Device-reported resting heart rate stream in bpm (not a one-time clinic measurement unless the source says otherwise).'
  if (t === 'focusindex')
    return 'Model-derived 0–100 score for inferred concentration or on-task engagement from the session signals.'
  if (t === 'spo2') return 'Peripheral oxygen saturation as a percentage when the sensor supplies it.'
  if (t === 'systolic') return 'Estimated systolic arterial pressure in mmHg when provided by the data source.'
  if (t === 'diastolic') return 'Estimated diastolic arterial pressure in mmHg when provided by the data source.'
  if (t === 'autonomicconfidence')
    return 'Pipeline confidence that autonomic-related estimates are reliable for this sample, as a percentage.'
  if (t === 'caloriesactive')
    return 'Estimated active energy expenditure from recorded movement, in kilocalories (cumulative or windowed per your ingest rules).'
  if (t === 'bodytempc') return 'Skin or body temperature estimate in °C when present in the feed.'
  return ''
}

function professionalEmotionLabel(token: string) {
  const t = token.toLowerCase()
  if (t === 'neutral') return 'Neutral (%)'
  if (t === 'happy') return 'Happy (%)'
  if (t === 'sadness') return 'Sad (%)'
  if (t === 'anger') return 'Anger (%)'
  if (t === 'fear') return 'Fear (%)'
  if (t === 'disgust') return 'Disgust (%)'
  if (t === 'surprise') return 'Surprise (%)'
  return humanizeMetricToken(token)
}

function splitEventTriggers(type: string): string[] {
  return type
    .split(' · ')
    .map((s) => s.trim())
    .filter(Boolean)
}

function eventChipTone(phrase: string): 'mp-event-chip--emo' | 'mp-event-chip--phys' {
  const p = phrase.toLowerCase()
  if (
    p.includes('negative score') ||
    p.includes('valence') ||
    p.includes('expression intensity') ||
    p.includes('expression entropy') ||
    p.includes('emotional state')
  ) {
    return 'mp-event-chip--emo'
  }
  return 'mp-event-chip--phys'
}

/** Stable hue per wearable channel: cool/teal family for vitals, distinct accents for load/metabolic. */
function physicalSeriesColor(key: string): string {
  const k = key.toLowerCase()
  if (k === 'hrvrmssd' || k.includes('hrv')) return '#0d9488'
  if (k === 'heartrate' || k === 'heartratebpm') return '#c2410c'
  if (k.includes('resting')) return '#9a3412'
  if (k.includes('focus')) return '#6d28d9'
  if (k === 'spo2' || k.includes('spo2')) return '#0369a1'
  if (k.includes('autonomic')) return '#a16207'
  if (k.includes('calorie')) return '#ea580c'
  if (k.includes('systolic') || k.includes('diastolic')) return '#4338ca'
  return '#0284c7'
}

function MultiLayerTimeline({
  aligned,
  events,
  topRelation,
  topLagMs,
}: {
  aligned: Array<{
    sessionTimeMs: number
    valence: number
    hrvRmssd: number
    heartRate: number
    physical: Record<string, number>
    emotions: {
      neutral: number
      happy: number
      sadness: number
      anger: number
      fear: number
      disgust: number
      surprise: number
    }
    autonomicState?: string
  }>
  events: Array<{ tMs: number; type: string; before: string; during: string; after: string }>
  topRelation: string | null
  topLagMs: number | null
}) {
  if (!aligned.length) return <p className="mp-chart-empty">No aligned samples available for timeline.</p>
  const labelW = 320
  const plotW = 1650
  const totalW = labelW + plotW
  const xPadL = labelW + 24
  const xPadR = 24
  const topPad = 18
  const bottomPad = 20
  const sectionTitleH = 24
  const rowH = 34
  const sectionGap = 22
  const maxT = aligned[aligned.length - 1]!.sessionTimeMs
  const sx = (t: number) => xPadL + (t / Math.max(1, maxT)) * (totalW - xPadL - xPadR)

  const physicalKeys = selectPhysicalKeys(aligned)
  const physRows = Math.max(1, physicalKeys.length)
  const emoKeys = ['neutral', 'happy', 'sadness', 'anger', 'fear', 'disgust', 'surprise'] as const
  const emoRows = emoKeys.length
  const physTitleY = topPad + 14
  const physTop = topPad + sectionTitleH
  const physBottom = physTop + physRows * rowH
  const dividerY = physBottom + sectionGap / 2
  const emoTitleY = physBottom + sectionGap + 14
  const emoTop = physBottom + sectionGap + sectionTitleH
  const emoBottom = emoTop + emoRows * rowH
  const H = emoBottom + bottomPad
  const laneMid = (sectionTop: number, idx: number) => sectionTop + idx * rowH + rowH / 2

  const emotionColors: Record<(typeof emoKeys)[number], string> = {
    neutral: '#64748b',
    happy: '#0f766e',
    sadness: '#1d4ed8',
    anger: '#e11d48',
    fear: '#6d28d9',
    disgust: '#854d0e',
    surprise: '#b45309',
  }
  const stressedZones = aligned.filter((x) => (x.autonomicState ?? '').toLowerCase().includes('stressed'))
  const physicalPaths = physicalKeys.map((k, i) => {
    const vals = aligned.map((a) => a.physical[k]).filter((x): x is number => Number.isFinite(x))
    const minV = vals.length ? Math.min(...vals) : 0
    const maxV = vals.length ? Math.max(...vals) : 1
    const yMid = laneMid(physTop, i)
    const amp = Math.max(8, rowH * 0.35)
    const points = aligned
      .filter((a) => Number.isFinite(a.physical[k]))
      .map((a) => {
        const y = yMid + amp - (((a.physical[k] ?? minV) - minV) / (maxV - minV || 1)) * (2 * amp)
        return `${sx(a.sessionTimeMs).toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    return { key: k, color: physicalSeriesColor(k), points }
  })
  const emotionPaths = Object.fromEntries(
    emoKeys.map((k, i) => {
      const yMid = laneMid(emoTop, i)
      const amp = Math.max(8, rowH * 0.35)
      const points = aligned
        .map((a) => {
          const p = Math.max(0, Math.min(1, a.emotions[k]))
          const y = yMid + amp - p * (2 * amp)
          return `${sx(a.sessionTimeMs).toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
      return [k, points]
    }),
  ) as Record<(typeof emoKeys)[number], string>

  const physicalLegendItems = physicalPaths.map((p) => ({
    key: p.key,
    label: professionalPhysicalLabel(p.key),
    color: p.color,
    blurb: physicalChannelOneLiner(p.key),
  }))
  const emotionLegendItems = emoKeys.map((k) => ({
    key: k,
    label: professionalEmotionLabel(k),
    color: emotionColors[k],
  }))

  const labelGutterFill = '#dfe8f6'
  const plotFill = '#ffffff'
  const gridStroke = '#9eb4d4'

  return (
    <figure className="mp-correlated-chart mp-correlated-chart--expanded">
      <div className="mp-matrix-wrap mp-matrix-wrap--timeline">
        <svg viewBox={`0 0 ${totalW} ${H}`} className="mp-correlated-chart__svg">
          <rect width={totalW} height={H} fill={plotFill} rx="6" />
          <rect x="0" y="0" width={labelW - 8} height={H} fill={labelGutterFill} rx="6" />
          <line x1={labelW - 8} y1="0" x2={labelW - 8} y2={H} stroke="#b8c9e4" strokeWidth="1.25" />

          <text x={labelW - 18} y={physTitleY} fill="var(--mp-text-dim)" fontSize="12" fontFamily="var(--mp-mono)" textAnchor="end" fontWeight="600">
            Physical
          </text>
          {physicalKeys.map((k, i) => (
            <text
              key={`pl-${k}`}
              x={labelW - 18}
              y={laneMid(physTop, i)}
              fill="var(--mp-text)"
              fontSize="12"
              fontFamily="var(--mp-mono)"
              dominantBaseline="middle"
              textAnchor="end"
              fontWeight="500"
            >
              {professionalPhysicalLabel(k)}
            </text>
          ))}

          <text x={labelW - 18} y={emoTitleY} fill="var(--mp-text-dim)" fontSize="12" fontFamily="var(--mp-mono)" textAnchor="end" fontWeight="600">
            Emotional
          </text>
          {emoKeys.map((k, i) => (
            <text
              key={`el-${k}`}
              x={labelW - 18}
              y={laneMid(emoTop, i)}
              fill="var(--mp-text)"
              fontSize="12"
              fontFamily="var(--mp-mono)"
              dominantBaseline="middle"
              textAnchor="end"
              fontWeight="500"
            >
              {professionalEmotionLabel(k)}
            </text>
          ))}

          <text x={xPadL + 4} y={physTitleY} fill="var(--mp-text-dim)" fontSize="12" fontFamily="var(--mp-mono)" fontWeight="600">
            Physical
          </text>
          <text x={xPadL + 4} y={emoTitleY} fill="var(--mp-text-dim)" fontSize="12" fontFamily="var(--mp-mono)" fontWeight="600">
            Emotional lanes
          </text>

          <line x1={xPadL} y1={dividerY} x2={totalW - xPadR} y2={dividerY} stroke="#7c9acb" strokeWidth="1.35" strokeDasharray="7 5" opacity="0.85" />

          {Array.from({ length: physRows }).map((_, i) => (
            <line
              key={`pr-${i}`}
              x1={xPadL}
              y1={laneMid(physTop, i)}
              x2={totalW - xPadR}
              y2={laneMid(physTop, i)}
              stroke={gridStroke}
              strokeWidth="1"
              opacity="0.42"
            />
          ))}
          {Array.from({ length: emoRows }).map((_, i) => (
            <line
              key={`er-${i}`}
              x1={xPadL}
              y1={laneMid(emoTop, i)}
              x2={totalW - xPadR}
              y2={laneMid(emoTop, i)}
              stroke={gridStroke}
              strokeWidth="1"
              opacity="0.42"
            />
          ))}

          {stressedZones.map((x, i) =>
            i % 10 === 0 ? (
              <rect
                key={`z-${i}`}
                x={sx(x.sessionTimeMs)}
                y={topPad}
                width="8"
                height={H - topPad - bottomPad}
                fill="rgba(181, 117, 20, 0.2)"
              />
            ) : null,
          )}
          {aligned.map((a, i) =>
            i % 12 === 0 ? (
              <line
                key={`g-${i}`}
                x1={sx(a.sessionTimeMs)}
                y1={topPad}
                x2={sx(a.sessionTimeMs)}
                y2={H - bottomPad}
                stroke={gridStroke}
                strokeWidth="1"
                opacity="0.35"
              />
            ) : null,
          )}
          {physicalPaths.map((p) => (
            <polyline
              key={`phys-${p.key}`}
              fill="none"
              stroke={p.color}
              strokeWidth={p.key.toLowerCase() === 'hrvrmssd' ? 2.6 : 2.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={p.points}
            />
          ))}
          {emoKeys.map((k) => (
            <polyline
              key={k}
              fill="none"
              stroke={emotionColors[k]}
              strokeWidth={k === 'neutral' ? 2 : 2.2}
              strokeDasharray={k === 'neutral' ? '5 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={k === 'neutral' ? 0.88 : 0.96}
              points={emotionPaths[k]}
            />
          ))}
          {events.map((e, i) => (
            <g key={`e-${i}`}>
              <line x1={sx(e.tMs)} y1={topPad} x2={sx(e.tMs)} y2={H - bottomPad} stroke="#c2410c" strokeWidth="1.75" opacity="0.9" />
              <circle cx={sx(e.tMs)} cy={topPad + 8} r="6.5" fill="#ffffff" stroke="#9a3412" strokeWidth="2" />
              <text x={sx(e.tMs) + 9} y={topPad + 12} fill="var(--mp-text)" fontSize="10" fontFamily="var(--mp-mono)" fontWeight="700">
                {`E${i + 1}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {topRelation ? (
        <p className="mp-fig__note">
          Top pair: <span className="mp-mono-inline">{humanizeRelationshipLabel(topRelation)}</span>
          {topLagMs != null ? ` · lag ${topLagMs} ms` : ''}
        </p>
      ) : null}
      <ul className="mp-correlated-chart__legend mp-correlated-chart__legend--key">
        <li>
          <span className="mp-leg-key mp-leg-key--line mp-leg-key--sci" /> HRV (RMSSD)
        </li>
        <li>
          <span className="mp-leg-key mp-leg-key--dash mp-leg-key--hr" /> Other physical channels (by variance)
        </li>
        <li>
          <span className="mp-leg-key mp-leg-key--line mp-leg-key--psy" /> Emotional (expression probabilities)
        </li>
        <li>
          <span className="mp-leg-key mp-leg-key--marker mp-leg-key--event" /> Events
        </li>
        <li>
          <span className="mp-leg-key mp-leg-key--zone mp-leg-key--zone-color" /> Stressed intervals
        </li>
      </ul>
      <details className="mp-subsection-collapsible">
        <summary>Channel mapping details</summary>
        <div className="mp-channel-legend-grid">
          <div className="mp-channel-legend-block">
            <h4 className="mp-subtitle">Physical (top → bottom)</h4>
            <ul className="mp-channel-legend-list mp-channel-legend-list--with-blurbs">
              {physicalLegendItems.map((item) => (
                <li key={`phys-legend-${item.key}`}>
                  <div className="mp-channel-legend-item">
                    <div className="mp-channel-legend-item__row">
                      <span className="mp-leg-key mp-leg-key--line" style={{ color: item.color }} />
                      <span>{item.label}</span>
                    </div>
                    {item.blurb ? <p className="mp-channel-legend-item__desc">{item.blurb}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mp-channel-legend-block">
            <h4 className="mp-subtitle">Emotional (top → bottom)</h4>
            <ul className="mp-channel-legend-list">
              {emotionLegendItems.map((item) => (
                <li key={`emo-legend-${item.key}`}>
                  <span className="mp-leg-key mp-leg-key--line" style={{ color: item.color }} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
      {events.length > 0 ? (
        <ul className="mp-event-inline-list">
          {events.map((e, i) => (
            <li key={`event-inline-${i}`}>
              <span className="mp-mono-inline">{`E${i + 1} @ ${(e.tMs / 1000).toFixed(1)}s`}</span>
              <span className="mp-event-inline-list__signals">
                {splitEventTriggers(e.type).map((phrase, ti) => (
                  <span
                    key={`${e.tMs}-${ti}-${phrase}`}
                    className={`mp-event-chip mp-event-chip--compact ${eventChipTone(phrase)}`}
                  >
                    {phrase}
                  </span>
                ))}
              </span>
              <span className="mp-event-inline-list__emo">
                {' '}
                · expression {e.before} → {e.during} → {e.after}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  )
}

function selectPhysicalKeys(
  aligned: Array<{ physical: Record<string, number> }>,
  maxKeys = 5,
) {
  const keys = Array.from(new Set(aligned.flatMap((a) => Object.keys(a.physical))))
  const scored = keys
    .map((k) => ({
      key: k,
      v: variance(
        aligned
          .map((a) => a.physical[k])
          .filter((x): x is number => Number.isFinite(x)),
      ),
    }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
  const mustKeep = ['hrvRmssd', 'heartRate'].filter((k) => scored.some((x) => x.key === k))
  const rest = scored.map((x) => x.key).filter((k) => !mustKeep.includes(k))
  return [...mustKeep, ...rest].slice(0, maxKeys)
}

function variance(xs: number[]) {
  if (xs.length < 2) return 0
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length
}

function MatrixCard({
  title,
  tm,
}: {
  title: string
  tm: { states: string[]; probs: number[][] }
}) {
  return (
    <div className="mp-card">
      <h3 className="mp-subtitle">{title}</h3>
      <div className="mp-matrix-wrap">
        <table className="mp-matrix mp-matrix--session">
          <thead>
            <tr>
              <th className="mp-matrix__corner" />
              {tm.states.map((s) => (
                <th key={s} className="mp-matrix__head">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tm.states.map((s, i) => (
              <tr key={s}>
                <th className="mp-matrix__head">{s}</th>
                {tm.probs[i]!.map((v, j) => (
                  <td key={`${s}-${tm.states[j]}`} className="mp-matrix__cell">
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CorrMatrixCard({
  kind,
  corr,
  variant = 'card',
}: {
  kind: 'pearson' | 'spearman'
  corr: { keys: string[]; values: (number | null)[][] }
  variant?: 'card' | 'stacked'
}) {
  const method = kind === 'pearson' ? 'Pearson' : 'Spearman'
  const thClass = (raw: string) =>
    WINDOWED_EMOTION_FEATURE_KEYS.has(raw)
      ? 'mp-matrix__head mp-matrix__head--emotion-param'
      : 'mp-matrix__head mp-matrix__head--physical-param'

  const table = (
    <div className={variant === 'stacked' ? 'mp-matrix-wrap mp-matrix-wrap--corr-scroll' : 'mp-matrix-wrap'}>
      <table
        className="mp-matrix mp-matrix--session"
        role="grid"
        aria-label={`${method} correlation between emotional and physical parameters, 3 second windows`}
      >
        <thead>
          <tr>
            <th className="mp-matrix__corner" scope="col">
              <span className="mp-matrix__corner-label">row \ col</span>
            </th>
            {corr.keys.map((k) => (
              <th key={k} scope="col" className={thClass(k)} title={WINDOWED_EMOTION_FEATURE_KEYS.has(k) ? 'Emotional parameter' : 'Physical parameter'}>
                {humanizeMetricToken(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corr.keys.map((rk, i) => (
            <tr key={rk}>
              <th scope="row" className={thClass(rk)}>
                {humanizeMetricToken(rk)}
              </th>
              {(corr.values[i] ?? []).map((v, j) => (
                <td key={`${rk}-${corr.keys[j]}`} className="mp-matrix__cell">
                  {v != null ? v.toFixed(2) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (variant === 'stacked') {
    return table
  }

  return (
    <div className="mp-card">
      <h3 className="mp-subtitle">
        {method} r — emotional vs physical parameters (3s windows)
      </h3>
      {table}
    </div>
  )
}
