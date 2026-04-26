type Trend = 'up' | 'down' | 'flat'

type KpiCardProps = {
  label: string
  value: string
  baseline: string
  trend: Trend
  confidence: string
  updated: string
}

const trendSymbol: Record<Trend, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

export function KpiCard({
  label,
  value,
  baseline,
  trend,
  confidence,
  updated,
}: KpiCardProps) {
  return (
    <article className="mp-kpi-card">
      <header className="mp-kpi-card__head">
        <span className="mp-kpi-card__label">{label}</span>
        <span className={`mp-kpi-card__trend mp-kpi-card__trend--${trend}`} title="vs baseline">
          {trendSymbol[trend]}
        </span>
      </header>
      <p className="mp-kpi-card__value">{value}</p>
      <p className="mp-kpi-card__baseline">vs baseline: {baseline}</p>
      <footer className="mp-kpi-card__foot">
        <span className="mp-kpi-card__conf">Confidence {confidence}</span>
        <time className="mp-kpi-card__time">{updated}</time>
      </footer>
    </article>
  )
}
