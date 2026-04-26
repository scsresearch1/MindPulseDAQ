import { useLayoutEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { adminPortalLogin } from '../config/appDeployConfig'

type LoginPageProps = {
  onAuthenticated: () => void
}

function LoginScienceStrip() {
  return (
    <div className="mp-login-science-strip" aria-hidden="true">
      <svg className="mp-login-science-strip__svg" viewBox="0 0 520 52" preserveAspectRatio="none">
        <defs>
          <pattern id="mpLoginGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M 16 0 L 0 0 0 16"
              fill="none"
              stroke="#1f5aa3"
              strokeOpacity="0.14"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id="mpLoginTraceA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1f7ae0" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#1f7ae0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1f7ae0" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect width="520" height="52" fill="url(#mpLoginGrid)" opacity="0.55" />
        <line x1="12" y1="38" x2="508" y2="38" stroke="#335883" strokeOpacity="0.35" strokeWidth="1" />
        <polyline
          fill="none"
          stroke="url(#mpLoginTraceA)"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          points="12,34 52,26 92,32 132,20 172,30 212,18 252,28 292,22 332,30 372,16 412,26 452,24 492,20 508,24"
        />
        <polyline
          fill="none"
          stroke="#7b66d9"
          strokeWidth="1.1"
          strokeOpacity="0.55"
          strokeDasharray="5 3"
          strokeLinecap="round"
          points="12,40 64,42 120,34 176,40 232,30 288,38 344,33 400,36 456,32 508,36"
        />
        <line x1="12" y1="12" x2="12" y2="44" stroke="#335883" strokeOpacity="0.25" strokeWidth="0.75" />
      </svg>
      <div className="mp-login-science-strip__footer">
        <span className="mp-login-science-strip__unit">t →</span>
        <span className="mp-login-science-strip__legend">Physio</span>
        <span className="mp-login-science-strip__legend mp-login-science-strip__legend--b">Expression</span>
      </div>
    </div>
  )
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useLayoutEffect(() => {
    const root = document.getElementById('root')
    if (!root) return undefined

    const mq = window.matchMedia('(min-width: 901px)')
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow

    const apply = () => {
      if (mq.matches) {
        root.classList.add('mp-root--login-only')
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
      } else {
        root.classList.remove('mp-root--login-only')
        document.documentElement.style.overflow = prevHtmlOverflow
        document.body.style.overflow = prevBodyOverflow
      }
    }

    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      root.classList.remove('mp-root--login-only')
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  const buildStamp = useMemo(
    () => new Date().toLocaleString('en-IN', { hour12: false }),
    [],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (username === adminPortalLogin.username && password === adminPortalLogin.password) {
      setErrorMessage('')
      onAuthenticated()
      return
    }
    setErrorMessage('Invalid credentials. Use the assigned admin account.')
  }

  return (
    <main className="mp-login-shell mp-login-shell--psych mp-login-shell--split">
      <div className="mp-login-layout mp-login-layout--split">
        <div className="mp-login-hero-column">
          <div className="mp-login-hero mp-login-hero--rigor">
            <div className="mp-login-hero__visual-row">
              <div className="mp-login-psych-visual" aria-hidden="true" />
              <p className="mp-login-hero__visual-caption">Concurrent streams · common time base</p>
            </div>
            <LoginScienceStrip />
            <p className="mp-eyebrow mp-eyebrow--psych">Pilot program · internal review</p>
            <h2 className="mp-login-hero__title">Physiology and affect, jointly observed</h2>
            <p className="mp-login-hero__scope">Time series · variance checks · not diagnostic</p>
            <p className="mp-login-hero__lede">Wearable physical signals and emotional expression series aligned for pilot review.</p>
            <ul className="mp-login-hero__list" aria-label="Workspace capabilities">
              <li>
                <span className="mp-login-hero__tag">Physiology stream</span>
                <span className="mp-login-hero__body">Resampled HRV / HR with basic reliability checks.</span>
              </li>
              <li>
                <span className="mp-login-hero__tag">Affective dynamics</span>
                <span className="mp-login-hero__body">Expression probabilities over time, session-scoped.</span>
              </li>
              <li>
                <span className="mp-login-hero__tag">Analytical protocol</span>
                <span className="mp-login-hero__body">Lag search, adequacy checks, quality score, windowed models.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mp-login-form-column">
          <section className="mp-login-panel mp-login-panel--pilot mp-login-panel--psych">
            <div className="mp-login-panel__instrument" aria-hidden="true">
              <span className="mp-login-panel__instrument-k">ACCESS</span>
              <span className="mp-login-panel__instrument-v">PDL-LAB · NODE</span>
              <span className="mp-login-panel__instrument-k">MODE</span>
              <span className="mp-login-panel__instrument-v">AUTH · RSA</span>
            </div>
            <h1 className="mp-login-panel__title">MindPulse Analyzer</h1>
            <p className="mp-login-sub mp-login-restriction">Authorized PDL Lab Staff only.</p>
            <form className="mp-login-form" onSubmit={handleSubmit}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              {errorMessage ? <p className="mp-login-error">{errorMessage}</p> : null}
              <button type="submit" className="mp-btn-primary mp-btn-primary--psych">
                Sign in
              </button>
            </form>
            <p className="mp-login-meta">Pilot build · {buildStamp}</p>
          </section>
        </div>
      </div>
    </main>
  )
}
