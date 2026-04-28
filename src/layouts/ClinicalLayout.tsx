import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ClinicalTermLegend } from '../components/ClinicalTermLegend'

type ClinicalLayoutProps = {
  onSignOut: () => void
}

export function ClinicalLayout({ onSignOut }: ClinicalLayoutProps) {
  const loc = useLocation()
  const researchCalendarActive =
    loc.pathname.startsWith('/calendar') || loc.pathname.startsWith('/cases/')

  return (
    <div className="mp-app mp-app--v4">
      <header className="mp-topbar">
        <div className="mp-topbar__brand">
          <span className="mp-topbar__mark">MP</span>
          <div>
            <div className="mp-topbar__title">MindPulse Analyzer</div>
            <div className="mp-topbar__tag">Pilot review</div>
          </div>
        </div>
        <div className="mp-topbar__meta">
          <span className="mp-status mp-status--amber">Pilot mode</span>
          <span className="mp-topbar__user">pulse_admin</span>
          <button type="button" className="mp-btn-ghost mp-btn-ghost--topbar" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="mp-workspace">
        <aside className="mp-sidebar mp-sidebar--rail" aria-label="Primary navigation">
          <p className="mp-sidebar__section-title">Views</p>
          <nav className="mp-sidebar__nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `mp-nav-link${isActive ? ' active' : ''}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/calendar"
              className={() => `mp-nav-link${researchCalendarActive ? ' active' : ''}`}
            >
              Pilot Test Reports
            </NavLink>
            <NavLink
              to="/scientific-analysis"
              className={({ isActive }) => `mp-nav-link${isActive ? ' active' : ''}`}
            >
              Data Export and Analysis
            </NavLink>
          </nav>
          <div className="mp-sidebar__foot" aria-hidden="true">
            Session review · pilot export
          </div>
        </aside>
        <div className="mp-main">
          <div className="mp-pilot-ribbon" role="note">
            <span className="mp-pilot-ribbon__label">Pilot</span>
            <span className="mp-pilot-ribbon__text">Pilot data — not for clinical use.</span>
          </div>
          <div className="mp-main__content">
            <Outlet />
            <div className="mp-legend-wrap mp-legend-wrap--v4">
              <ClinicalTermLegend />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
