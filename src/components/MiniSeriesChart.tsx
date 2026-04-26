type MiniSeriesChartProps = {
  title: string
  subtitle?: string
  variant?: 'line' | 'band'
  alertBand?: boolean
}

/** Lightweight SVG time-series view (no chart library). */
export function MiniSeriesChart({
  title,
  subtitle,
  variant = 'line',
  alertBand = false,
}: MiniSeriesChartProps) {
  return (
    <figure className="mp-mini-chart">
      <figcaption className="mp-mini-chart__cap">
        <strong>{title}</strong>
        {subtitle ? <span className="mp-mini-chart__sub">{subtitle}</span> : null}
      </figcaption>
      <svg
        className="mp-mini-chart__svg"
        viewBox="0 0 320 80"
        role="img"
        aria-label={`${title} time series preview`}
      >
        <rect width="320" height="80" fill="var(--mp-chart-bg)" rx="4" />
        <line
          x1="8"
          y1="40"
          x2="312"
          y2="40"
          stroke="var(--mp-border)"
          strokeWidth="0.5"
          strokeDasharray="4 3"
        />
        {variant === 'band' ? (
          <path
            d="M 8 52 Q 80 30 160 38 T 312 44 L 312 58 Q 200 62 120 56 T 8 52 Z"
            fill="var(--mp-chart-band)"
            opacity="0.45"
          />
        ) : null}
        {alertBand ? (
          <rect x="180" y="8" width="48" height="64" fill="var(--mp-dropout)" rx="2" />
        ) : null}
        <polyline
          fill="none"
          stroke="var(--mp-accent-sci)"
          strokeWidth="1.5"
          points="8,50 40,46 72,38 104,42 136,28 168,32 200,24 232,30 264,22 296,26 312,20"
        />
        <circle cx="136" cy="28" r="3" fill="var(--mp-amber)" stroke="var(--mp-bg-panel)" strokeWidth="1" />
      </svg>
    </figure>
  )
}
