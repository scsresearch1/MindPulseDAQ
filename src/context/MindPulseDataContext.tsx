import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { groupSessionsByDay, parseSessionsFromExport, fetchMindPulseExport } from '../lib/loadExport'
import { fetchSessionsFromFirebase } from '../lib/firebaseSessions'
import type { SessionRecord } from '../types/mindpulseExport'

type DataSource = 'firebase' | 'local_export'

type MindPulseDataContextValue = {
  sessions: SessionRecord[]
  byDay: Map<string, SessionRecord[]>
  source: DataSource
  loading: boolean
  error: string | null
  notice: string | null
  reload: () => Promise<void>
}

const MindPulseDataContext = createContext<MindPulseDataContextValue | null>(null)

export function MindPulseDataProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [source, setSource] = useState<DataSource>('local_export')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const live = await fetchSessionsFromFirebase()
      setSessions(live)
      setSource('firebase')
    } catch (e) {
      try {
        const root = await fetchMindPulseExport()
        const list = parseSessionsFromExport(root)
        setSessions(list)
        setSource('local_export')
        const reason = e instanceof Error ? e.message : 'Firebase fetch failed'
        setNotice(`Live Firebase unavailable (${reason}). Using local export file.`)
      } catch (localErr) {
        setSessions([])
        setSource('local_export')
        setError(localErr instanceof Error ? localErr.message : 'Failed to load dataset')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => groupSessionsByDay(sessions), [sessions])

  const value = useMemo(
    () => ({ sessions, byDay, source, loading, error, notice, reload: load }),
    [sessions, byDay, source, loading, error, notice, load],
  )

  return <MindPulseDataContext.Provider value={value}>{children}</MindPulseDataContext.Provider>
}

export function useMindPulseData() {
  const ctx = useContext(MindPulseDataContext)
  if (!ctx) throw new Error('useMindPulseData must be used within MindPulseDataProvider')
  return ctx
}
