/** Subset of RTDB export shape under mindpulse/v1/sessions/{sessionKey} */

export type EmotionTimePoint = {
  sessionTimeMs: number
  anger: number
  disgust: number
  fear: number
  happy: number
  neutral: number
  sadness: number
  surprise: number
  caseId?: string
}

export type PhysicalTimePoint = {
  sessionTimeMs: number
  heartRate: number
  hrvRmssd: number
  autonomicState?: string
  autonomicStability?: string
  autonomicConfidence?: number
  mentalLoad?: string
  focusIndex?: number
  spo2?: number
  systolic?: number
  diastolic?: number
  bodyTempC?: number
  caseId?: string
  [key: string]: unknown
}

export type SessionConsent = {
  allAccepted?: boolean
  caseId?: string
  consentSubmittedAt?: string
  participantName?: string
}

export type SessionRecord = {
  sessionKey: string
  caseId?: string
  participantName?: string
  age?: number
  gender?: string
  schemaVersion?: number
  sessionEndedAt?: string
  submittedAt?: number
  daqUpdatedAt?: string
  consent?: SessionConsent
  emotionTimeSeries?: EmotionTimePoint[]
  physicalTimeSeries?: PhysicalTimePoint[]
  sessionMeta?: Record<string, unknown>
}

export type MindPulseExportRoot = {
  mindpulse?: {
    v1?: {
      sessions?: Record<string, unknown>
    }
  }
}
