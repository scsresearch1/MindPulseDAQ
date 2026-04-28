import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MindPulseDataProvider } from './context/MindPulseDataContext'
import { ClinicalLayout } from './layouts/ClinicalLayout'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ResearchCalendarPage } from './pages/ResearchCalendarPage'
import { ScientificLabPage } from './pages/ScientificLabPage'

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)

  if (!authenticated) {
    return <LoginPage onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <MindPulseDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ClinicalLayout onSignOut={() => setAuthenticated(false)} />}>
            <Route index element={<DashboardPage />} />
            <Route path="calendar" element={<ResearchCalendarPage />} />
            <Route path="cases/:sessionKey" element={<CaseDetailPage />} />
            <Route path="scientific-analysis" element={<ScientificLabPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MindPulseDataProvider>
  )
}
