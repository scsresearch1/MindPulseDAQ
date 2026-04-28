import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildSessionCorrelationPack } from '../lib/correlationAdvanced'
import type { EmotionPhysRow } from '../lib/correlationAdvanced'
import type { SessionRecord } from '../types/mindpulseExport'

function strongestCell(matrix: EmotionPhysRow[]): string {
  let best = ''
  let bestR = 0
  for (const row of matrix) {
    for (const [lab, r] of [
      ['HR', row.rHeartRate],
      ['RMSSD', row.rHrvRmssd],
      ['Focus', row.rFocusIndex],
    ] as const) {
      if (r == null) continue
      if (!best || Math.abs(r) > bestR) {
        bestR = Math.abs(r)
        best = `${row.emotion}×${lab} (${r.toFixed(2)})`
      }
    }
  }
  return best || '—'
}

export function PilotSessionLinkageTable({ sessions }: { sessions: SessionRecord[] }) {
  const rows = useMemo(() => {
    return sessions.map((s) => {
      const p = buildSessionCorrelationPack(s)
      return {
        sessionKey: s.sessionKey,
        caseId: s.caseId ?? '—',
        zeroR: p.zeroLagR,
        bestLagMs: p.bestLag?.lagMs ?? null,
        bestR: p.bestLag?.r ?? null,
        peak: strongestCell(p.matrix),
      }
    })
  }, [sessions])

  if (!rows.length) {
    return <p className="mp-text-muted">No sessions loaded.</p>
  }

  return (
    <div className="mp-matrix-wrap">
      <table className="mp-table mp-pilot-link-table" role="table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Session</th>
            <th>r (emotional valence, physical RMSSD) @0 lag</th>
            <th>Best lag (ms)</th>
            <th>Best |r|</th>
            <th>Strongest emotional×physical pair</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sessionKey}>
              <td className="mp-mono-inline">{r.caseId}</td>
              <td className="mp-mono-inline" style={{ fontSize: '0.72rem' }} title={r.sessionKey}>
                {r.sessionKey.length > 24 ? `${r.sessionKey.slice(0, 22)}…` : r.sessionKey}
              </td>
              <td>{r.zeroR != null ? r.zeroR.toFixed(3) : '—'}</td>
              <td>{r.bestLagMs != null ? r.bestLagMs : '—'}</td>
              <td>{r.bestR != null ? r.bestR.toFixed(3) : '—'}</td>
              <td style={{ fontSize: '0.78rem' }}>{r.peak}</td>
              <td>
                <Link className="mp-inline-link" to={`/cases/${encodeURIComponent(r.sessionKey)}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
