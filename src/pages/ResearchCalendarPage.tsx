import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { localExportPublicPath } from '../config/appDeployConfig'
import { useMindPulseData } from '../context/MindPulseDataContext'
import type { SessionRecord } from '../types/mindpulseExport'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function monthMatrix(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: ({ key: string; inMonth: boolean; date: Date } | null)[] = []

  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d)
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    cells.push({ key, inMonth: true, date })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatDayHeading(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTs(ms: number | undefined) {
  if (ms == null) return null
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return null
  }
}

function SessionReportCard({ session }: { session: SessionRecord }) {
  const submitted = formatTs(session.submittedAt)
  const ended = session.sessionEndedAt ?? null
  return (
    <article className="mp-report-session">
      <div className="mp-report-session__body">
        <div className="mp-report-session__top">
          <span className="mp-report-session__case">Case {session.caseId ?? '—'}</span>
          <span className="mp-report-session__who">{session.participantName ?? '—'}</span>
        </div>
        <dl className="mp-report-session__meta">
          {ended ? (
            <div className="mp-report-session__row">
              <dt>Session end</dt>
              <dd>{ended}</dd>
            </div>
          ) : null}
          {submitted ? (
            <div className="mp-report-session__row">
              <dt>Uploaded</dt>
              <dd>{submitted}</dd>
            </div>
          ) : null}
          <div className="mp-report-session__row mp-report-session__row--key">
            <dt>Session key</dt>
            <dd>
              <code className="mp-mono-inline">{session.sessionKey}</code>
            </dd>
          </div>
        </dl>
      </div>
      <Link className="mp-report-session__cta" to={`/cases/${encodeURIComponent(session.sessionKey)}`}>
        Open report
      </Link>
    </article>
  )
}

export function ResearchCalendarPage() {
  const { byDay, loading, error, notice, sessions, source } = useMindPulseData()
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dateKey(today))

  const year = cursor.getFullYear()
  const monthIndex = cursor.getMonth()
  const cells = useMemo(() => monthMatrix(year, monthIndex), [year, monthIndex])

  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthPrefix = `${year}-${pad2(monthIndex + 1)}`

  const selectedSessions = selectedKey ? (byDay.get(selectedKey) ?? []) : []

  const daysWithData = useMemo(() => new Set(byDay.keys()), [byDay])

  const sessionCountThisMonth = useMemo(() => {
    let n = 0
    for (const [k, arr] of byDay.entries()) {
      if (k.startsWith(monthPrefix)) n += arr.length
    }
    return n
  }, [byDay, monthPrefix])

  const daysWithUploadsThisMonth = useMemo(() => {
    let n = 0
    for (const k of byDay.keys()) {
      if (k.startsWith(monthPrefix)) n += 1
    }
    return n
  }, [byDay, monthPrefix])

  if (loading) {
    return (
      <div className="mp-reports-page">
        <p className="mp-text-muted">Loading registry…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mp-reports-page">
        <p className="mp-login-error">{error}</p>
        <p className="mp-text-muted">
          Ensure <code className="mp-mono-inline">{`public${localExportPublicPath}`}</code> is present.
        </p>
      </div>
    )
  }

  return (
    <div className="mp-reports-page">
      <header className="mp-reports-hero">
        <div className="mp-reports-hero__text">
          <p className="mp-reports-kicker">Pilot registry</p>
          <h1 className="mp-reports-title">Pilot Test Reports</h1>
          <p className="mp-reports-lede">Choose a test day in the month grid, then open a session report.</p>
        </div>
        <ul className="mp-reports-stats" aria-label="Dataset summary">
          <li>
            <span className="mp-reports-stats__v">{sessions.length}</span>
            <span className="mp-reports-stats__l">sessions in load</span>
          </li>
          <li>
            <span className="mp-reports-stats__v">{sessionCountThisMonth}</span>
            <span className="mp-reports-stats__l">uploads this month</span>
          </li>
          <li>
            <span className="mp-reports-stats__v">{daysWithUploadsThisMonth}</span>
            <span className="mp-reports-stats__l">days with data</span>
          </li>
          <li className="mp-reports-stats--wide">
            <span className="mp-reports-stats__v mp-mono-inline">{source === 'firebase' ? 'RTDB' : 'Local JSON'}</span>
            <span className="mp-reports-stats__l">source</span>
          </li>
        </ul>
      </header>

      {notice ? <p className="mp-reports-notice mp-text-muted">{notice}</p> : null}

      <div className="mp-reports-split">
        <aside className="mp-reports-picker" aria-label="Select month and day">
          <p className="mp-reports-picker__label">Test calendar</p>
          <div className="mp-reports-picker__toolbar">
            <button
              type="button"
              className="mp-btn-ghost mp-calendar-navbtn"
              onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="mp-calendar-month">{monthLabel}</span>
            <button
              type="button"
              className="mp-btn-ghost mp-calendar-navbtn"
              onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <div className="mp-calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className="mp-calendar-wd">
                {d}
              </div>
            ))}
          </div>
          <div className="mp-calendar-cells">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} className="mp-calendar-cell mp-calendar-cell--empty" />
              const count = byDay.get(cell.key)?.length ?? 0
              const isSelected = cell.key === selectedKey
              const hasData = daysWithData.has(cell.key)
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`mp-calendar-cell${isSelected ? ' mp-calendar-cell--selected' : ''}${hasData ? ' mp-calendar-cell--hasdata' : ''}`}
                  onClick={() => setSelectedKey(cell.key)}
                >
                  <span className="mp-calendar-daynum">{cell.date.getDate()}</span>
                  {count > 0 ? <span className="mp-calendar-badge">{count}</span> : null}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="mp-reports-panel" aria-labelledby="mp-reports-day-title">
          <div className="mp-reports-panel__head">
            <h2 id="mp-reports-day-title" className="mp-reports-panel__title">
              {formatDayHeading(selectedKey)}
            </h2>
            <p className="mp-reports-panel__count">
              {selectedSessions.length} session{selectedSessions.length === 1 ? '' : 's'}
            </p>
          </div>

          {selectedSessions.length === 0 ? (
            <p className="mp-reports-empty">No uploads on this day.</p>
          ) : (
            <div className="mp-reports-session-stack">
              {selectedSessions.map((s) => (
                <SessionReportCard key={s.sessionKey} session={s} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
