const TERMS: Array<{ term: string; meaning: string }> = [
  {
    term: 'Physical–emotional correlation',
    meaning: 'How emotional parameters (expression-derived) move with physical wearable parameters in time.',
  },
  { term: 'HR', meaning: 'Heart rate (bpm).' },
  { term: 'HRV', meaning: 'Beat-to-beat interval variation.' },
  { term: 'RMSSD', meaning: 'Short-term HRV from successive differences.' },
  { term: 'SpO2', meaning: 'Oxygen saturation from the wearable.' },
  { term: 'Systolic / Diastolic', meaning: 'Blood pressure (mmHg).' },
  { term: 'Autonomic state', meaning: 'Model label for balance / stress tendency.' },
  { term: 'Sympathetic', meaning: 'Arousal-linked autonomic branch.' },
  { term: 'Valence proxy', meaning: 'Expression-based positive vs negative tilt.' },
  { term: 'Pearson r', meaning: 'Linear correlation (−1 … +1).' },
  { term: 'Lag (ms)', meaning: 'Time shift between two series.' },
  { term: 'Rolling correlation', meaning: 'Correlation in moving windows.' },
  { term: 'OLS / R2', meaning: 'Linear fit and explained variance.' },
  { term: 'Confidence score', meaning: 'Model confidence, not diagnosis.' },
]

export function ClinicalTermLegend() {
  return (
    <details className="mp-legend mp-legend--v4" open>
      <summary className="mp-legend__summary">Terms used in tables and charts</summary>
      <p className="mp-legend__note">Reference only — not medical advice.</p>
      <div className="mp-legend__tablewrap">
        <table className="mp-legend__table">
          <thead>
            <tr>
              <th scope="col">Term</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {TERMS.map((item) => (
              <tr key={item.term}>
                <td className="mp-legend__term">{item.term}</td>
                <td>{item.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
