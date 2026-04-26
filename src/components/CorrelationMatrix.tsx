import type { CSSProperties } from 'react'

const LABELS = ['HR', 'HRV', 'Motion', 'Temp', 'Mood']

const DEMO: number[][] = [
  [1, 0.62, 0.31, 0.18, -0.41],
  [0.62, 1, 0.22, 0.09, -0.55],
  [0.31, 0.22, 1, 0.12, 0.08],
  [0.18, 0.09, 0.12, 1, -0.19],
  [-0.41, -0.55, 0.08, -0.19, 1],
]

function cellStyle(v: number): CSSProperties {
  const t = (v + 1) / 2
  const r = Math.round(24 + (1 - t) * 40)
  const g = Math.round(32 + t * 70)
  const b = Math.round(48 + t * 90)
  return {
    background: `rgb(${r},${g},${b})`,
    color: t > 0.55 ? '#e8ecf0' : '#b8c0cc',
  }
}

export function CorrelationMatrix() {
  return (
    <div className="mp-matrix-wrap">
      <table className="mp-matrix" role="grid" aria-label="Demo physical–emotional style correlation matrix">
        <thead>
          <tr>
            <th className="mp-matrix__corner" />
            {LABELS.map((l) => (
              <th key={l} scope="col" className="mp-matrix__head">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEMO.map((row, i) => (
            <tr key={LABELS[i]}>
              <th scope="row" className="mp-matrix__head">
                {LABELS[i]}
              </th>
              {row.map((cell, j) => (
                <td key={`${i}-${j}`} className="mp-matrix__cell" style={cellStyle(cell)}>
                  {cell.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mp-matrix-note">
        Illustrative Pearson r (demo layout). Live cases use emotional vs physical parameters on the session timeline.
      </p>
    </div>
  )
}
