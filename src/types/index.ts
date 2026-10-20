/**
 * Core data models shared across the l-helper app.
 */

/** Who is speaking in a transcript segment. */
export type Speaker = 'interviewer' | 'candidate'

/** Lifecycle state of a generated answer. */
export type AnswerStatus = 'pending' | 'streaming' | 'complete' | 'error'

/** Which audio input source the listener should use. */
export type AudioMode = 'standard' | 'voice-filter' | 'network-stream'

/** Acoustic fingerprint of the user's voice used by the voice filter. */
export interface VoiceProfile {
  /** Approximate fundamental frequency in Hz. */
  pitch: number
  /** Spectral centroid in Hz. */
  spectralCentroid: number
  /** Epoch milliseconds when the profile was captured. */
  createdAt: number
}

/** Live classification state surfaced by the voice filter. */
export type VoiceFilterState = 'idle' | 'no-profile' | 'self' | 'external'

/**
 * Locally-stored candidate context used to enrich answers
 * before they are sent to the assistant.
 */
export interface CandidateProfile {
  fullName: string
  roleTitle: string
  summary: string
  technicalSkills: string[]
  keyAchievements: string[]
  customContext: string
}

/** User-configurable assistant connection + generation settings. */
export interface AppSettings {
  apiEndpoint: string
  apiKey: string
  modelName: string
  temperature: number
  autoSendOnFinal: boolean
  systemPromptTemplate: string
  audioMode: AudioMode
  networkStreamUrl: string
  voiceMatchThreshold: number
}

/** A single captured utterance from the live feed. */
export interface TranscriptItem {
  id: string
  text: string
  timestamp: number
  isFinal: boolean
  speaker: Speaker
}

/** A generated (streaming) answer tied back to a question. */
export interface AnswerItem {
  id: string
  questionId: string
  questionText: string
  answerText: string
  status: AnswerStatus
  /** Present only when status is 'error'. */
  error?: string
  timestamp: number
}
