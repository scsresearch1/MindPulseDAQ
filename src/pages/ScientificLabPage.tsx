import { PilotSessionLinkageTable } from '../components/PilotSessionLinkageTable'
import { useMindPulseData } from '../context/MindPulseDataContext'
import { buildSessionsCsvRows, downloadTextFile } from '../lib/csvExport'

export function ScientificLabPage() {
  const { sessions, loading, error, notice, source } = useMindPulseData()

  const handleDownloadCsv = () => {
    const csv = buildSessionsCsvRows(sessions)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`mindpulse-pilot-sessions-${stamp}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="mp-lab">
      <header className="mp-lab-header">
        <div>
          <h1 className="mp-lab-title">Data Export and Analysis</h1>
          <p className="mp-lab-lede">Cross-session table and CSV export.</p>
          {error ? <p className="mp-login-error">{error}</p> : null}
          {notice ? <p className="mp-text-muted">{notice}</p> : null}
          {!loading && !error ? (
            <p className="mp-lab-dataset mp-mono-inline">
              Source: {source === 'firebase' ? 'Firebase RTDB' : 'Local JSON'} · {sessions.length} rows
            </p>
          ) : null}
        </div>
        <div className="mp-lab-actions">
          <button
            type="button"
            className="mp-btn-secondary"
            onClick={handleDownloadCsv}
            disabled={loading || sessions.length === 0}
          >
            Download CSV
          </button>
        </div>
      </header>

      <div className="mp-lab-grid">
        <section className="mp-card mp-lab-span2" aria-labelledby="lab-corr-pilot">
          <h2 id="lab-corr-pilot" className="mp-card__title">
            Cross-session physical–emotional summary
          </h2>
          <p className="mp-card__desc">
            Per-session linkage between emotional proxies and physical (wearable) signals. Open a case for full
            analysis.
          </p>
          <PilotSessionLinkageTable sessions={sessions} />
        </section>
      </div>
    </div>
  )
}
