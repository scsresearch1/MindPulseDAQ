import { Link, useParams } from 'react-router-dom'
import { AdvancedCaseAnalysisSection } from '../components/AdvancedCaseAnalysisSection'
import { CrossDomainCorrelationSection } from '../components/CrossDomainCorrelationSection'
import { useMindPulseData } from '../context/MindPulseDataContext'

export function CaseDetailPage() {
  const { sessionKey: rawKey } = useParams<{ sessionKey: string }>()
  const sessionKey = rawKey ? decodeURIComponent(rawKey) : ''
  const { sessions, loading, error } = useMindPulseData()

  const session = sessions.find((s) => s.sessionKey === sessionKey)

  if (loading) {
    return (
      <div className="mp-case-page">
        <p className="mp-text-muted">Loading…</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mp-case-page">
        <p className="mp-login-error">{error ?? 'Session not found in the loaded export.'}</p>
        <Link to="/calendar" className="mp-back-link">
          ← Back to pilot test reports
        </Link>
      </div>
    )
  }

  return (
    <div className="mp-case-page mp-case-page--redesign">
      <nav className="mp-case-breadcrumb">
        <Link to="/calendar">Pilot Test Reports</Link>
        <span aria-hidden="true"> / </span>
        <span className="mp-mono-inline">{session.caseId ?? '—'}</span>
      </nav>

      <header className="mp-case-header">
        <div>
          <p className="mp-pilot-inline-badge">Pilot case</p>
          <h1 className="mp-dash-title">Case {session.caseId ?? '—'}</h1>
          <p className="mp-dash-lede">
            Session <span className="mp-mono-inline">{session.sessionKey}</span>
            {session.sessionEndedAt ? (
              <>
                {' '}
                · ended <time dateTime={session.sessionEndedAt}>{session.sessionEndedAt}</time>
              </>
            ) : null}
            {' '}
            · analysis centers on physical–emotional correlation for this pilot.
          </p>
        </div>
        <dl className="mp-case-meta">
          <div>
            <dt>Participant</dt>
            <dd>{session.participantName ?? '—'}</dd>
          </div>
          <div>
            <dt>Age / gender</dt>
            <dd>
              {session.age ?? '—'} / {session.gender ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Submitted (server)</dt>
            <dd className="mp-mono-inline">
              {session.submittedAt != null ? new Date(session.submittedAt).toISOString() : '—'}
            </dd>
          </div>
        </dl>
      </header>

      <AdvancedCaseAnalysisSection session={session} />

      <CrossDomainCorrelationSection session={session} />
    </div>
  )
}
