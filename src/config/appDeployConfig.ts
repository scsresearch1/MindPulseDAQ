/**
 * Static deployment configuration only — no Netlify / Vite environment variables.
 * Change values here and redeploy; do not rely on dashboard env vars.
 */
import type { FirebaseOptions } from 'firebase/app'

export const firebaseWebConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCgPI6xpYNUr8PLJwPdilXJubiMzmAKEEE',
  authDomain: 'mindpulse-82eb0.firebaseapp.com',
  databaseURL: 'https://mindpulse-82eb0-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mindpulse-82eb0',
  storageBucket: 'mindpulse-82eb0.firebasestorage.app',
  messagingSenderId: '505194302790',
  appId: '1:505194302790:web:e1590bd08abd1ad2bb2947',
  measurementId: 'G-CP2DNR2EL1',
}

/** RTDB path read by the analyzer (same as DAQ upload target). */
export const firebaseSessionsPath = 'mindpulse/v1/sessions'

/** Fallback JSON under `public/` when live RTDB fetch fails. */
export const localExportPublicPath = '/mindpulse-rtdb-export.json'

/** Client-only gate for the research UI (not Firebase Auth). */
export const adminPortalLogin = {
  username: 'pulse_admin',
  password: 'Pulse@2026',
} as const
