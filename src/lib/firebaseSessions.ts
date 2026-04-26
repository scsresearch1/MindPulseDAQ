import { getApps, initializeApp } from 'firebase/app'
import { get, getDatabase, ref } from 'firebase/database'
import { firebaseSessionsPath, firebaseWebConfig } from '../config/appDeployConfig'
import { parseSessionsFromExport } from './loadExport'
import type { MindPulseExportRoot, SessionRecord } from '../types/mindpulseExport'

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp(firebaseWebConfig)
}

export async function fetchSessionsFromFirebase(): Promise<SessionRecord[]> {
  const app = getFirebaseApp()
  const db = getDatabase(app)
  const snap = await get(ref(db, firebaseSessionsPath))
  const raw = snap.val()

  const root: MindPulseExportRoot = {
    mindpulse: {
      v1: {
        sessions: raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {},
      },
    },
  }
  return parseSessionsFromExport(root)
}
