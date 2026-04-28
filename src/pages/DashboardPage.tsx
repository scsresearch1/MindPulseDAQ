import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMindPulseData } from '../context/MindPulseDataContext'

export function DashboardPage() {
  const { sessions, source, loading, error, notice } = useMindPulseData()

  const summary = useMemo(() => {
    const uniqueCases = new Set(
      sessions.map((s) => String(s.caseId ?? '').trim()).filter((x) => x.length > 0),
    ).size
    const uniqueSubjects = new Set(
      sessions
        .map((s) => String(s.participantName ?? '').trim().toLowerCase())
        .filter((x) => x.length > 0),
    ).size
    const submitted = sessions
      .map((s) => s.submittedAt)
      .filter((x): x is number => typeof x === 'number')
      .sort((a, b) => b - a)
    const latest = submitted[0] ? new Date(submitted[0]).toISOString() : null
    const consentedSessions = sessions.filter((s) => s.consent?.allAccepted === true).length
    const endedAt = sessions
      .map((s) => s.sessionEndedAt)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .sort()
    const dateRange =
      endedAt.length > 0 ? `${endedAt[0]!.slice(0, 10)} → ${endedAt[endedAt.length - 1]!.slice(0, 10)}` : '—'
    return {
      totalSessions: sessions.length,
      uniqueSubjects,
      uniqueCases,
      latest,
      consentedSessions,
      dateRange,
    }
  }, [sessions])

  return (
    <div className="mp-dash mp-dash--v4">
      <header className="mp-dash-header mp-dash-header--v4">
        <div className="mp-dash-header__intro">
          <h1 className="mp-dash-title">Overview</h1>
          <p className="mp-dash-lede">Loaded sessions — counts below.</p>
        </div>
        <div className="mp-dash-header__meta">
          <div className="mp-dash-header__pill">
            <span className="mp-status mp-status--amber">Pilot</span>
            <span className="mp-dash-header__id">
              {source === 'firebase' ? 'RTDB' : 'Local JSON'}
            </span>
          </div>
          <nav className="mp-dash-quick" aria-label="Shortcuts">
            <Link className="mp-dash-quick__link" to="/calendar">
              <span className="mp-dash-quick__k">Pilot Test Reports</span>
              <span className="mp-dash-quick__d">Sessions by day</span>
            </Link>
            <Link className="mp-dash-quick__link" to="/scientific-analysis">
              <span className="mp-dash-quick__k">Data Export and Analysis</span>
              <span className="mp-dash-quick__d">CSV & cross-session</span>
            </Link>
          </nav>
        </div>
      </header>

      {error ? <p className="mp-login-error">{error}</p> : null}
      {notice ? <p className="mp-text-muted">{notice}</p> : null}

      <section className="mp-kpi-strip mp-kpi-strip--v4" aria-label="Summary">
        <SummaryCard label="Sessions" value={String(summary.totalSessions)} variant={0} />
        <SummaryCard label="Subjects" value={String(summary.uniqueSubjects)} variant={1} />
        <SummaryCard label="Cases" value={String(summary.uniqueCases)} variant={2} />
        <SummaryCard label="Consented" value={String(summary.consentedSessions)} variant={3} />
        <SummaryCard label="Date range" value={summary.dateRange} variant={4} />
        <SummaryCard
          label="Latest upload"
          value={summary.latest ? summary.latest.slice(0, 19) : '—'}
          variant={5}
        />
      </section>

      {loading ? <p className="mp-text-muted">Refreshing dataset…</p> : null}
    </div>
  )
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant: number }) {
  return (
    <article className={`mp-kpi-card mp-kpi-card--accent-${variant % 6}`}>
      <header className="mp-kpi-card__head">
        <span className="mp-kpi-card__label">{label}</span>
      </header>
      <p className="mp-kpi-card__value">{value}</p>
    </article>
  )
}
