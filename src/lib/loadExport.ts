import { localExportPublicPath } from '../config/appDeployConfig'
import type { MindPulseExportRoot, SessionRecord } from '../types/mindpulseExport'

export async function fetchMindPulseExport(): Promise<MindPulseExportRoot> {
  const res = await fetch(localExportPublicPath)
  if (!res.ok) throw new Error(`Failed to load export: ${res.status}`)
  return res.json() as Promise<MindPulseExportRoot>
}

function isSessionPayload(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseSessionsFromExport(root: MindPulseExportRoot): SessionRecord[] {
  const raw = root.mindpulse?.v1?.sessions
  if (!raw || typeof raw !== 'object') return []

  const out: SessionRecord[] = []
  for (const [sessionKey, payload] of Object.entries(raw)) {
    if (!isSessionPayload(payload)) continue
    if (!('caseId' in payload) && !('emotionTimeSeries' in payload)) continue

    const {
      caseId,
      participantName,
      age,
      gender,
      schemaVersion,
      sessionEndedAt,
      submittedAt,
      daqUpdatedAt,
      consent,
      emotionTimeSeries,
      physicalTimeSeries,
      sessionMeta,
    } = payload as Record<string, unknown>

    out.push({
      sessionKey,
      caseId: typeof caseId === 'string' ? caseId : undefined,
      participantName: typeof participantName === 'string' ? participantName : undefined,
      age: typeof age === 'number' ? age : undefined,
      gender: typeof gender === 'string' ? gender : undefined,
      schemaVersion: typeof schemaVersion === 'number' ? schemaVersion : undefined,
      sessionEndedAt: typeof sessionEndedAt === 'string' ? sessionEndedAt : undefined,
      submittedAt: typeof submittedAt === 'number' ? submittedAt : undefined,
      daqUpdatedAt: typeof daqUpdatedAt === 'string' ? daqUpdatedAt : undefined,
      consent: consent as SessionRecord['consent'],
      emotionTimeSeries: Array.isArray(emotionTimeSeries)
        ? (emotionTimeSeries as SessionRecord['emotionTimeSeries'])
        : undefined,
      physicalTimeSeries: Array.isArray(physicalTimeSeries)
        ? (physicalTimeSeries as SessionRecord['physicalTimeSeries'])
        : undefined,
      sessionMeta: sessionMeta as SessionRecord['sessionMeta'],
    })
  }
  return out
}

/** Calendar bucket key YYYY-MM-DD in local timezone */
export function sessionCalendarDay(session: SessionRecord): string | null {
  if (session.sessionEndedAt) {
    const d = new Date(session.sessionEndedAt)
    if (!Number.isNaN(d.getTime())) return localDateKey(d)
  }
  if (typeof session.submittedAt === 'number') {
    return localDateKey(new Date(session.submittedAt))
  }
  return null
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function groupSessionsByDay(sessions: SessionRecord[]): Map<string, SessionRecord[]> {
  const map = new Map<string, SessionRecord[]>()
  for (const s of sessions) {
    const key = sessionCalendarDay(s)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
  }
  return map
}
