import type { AppSettings, CandidateProfile } from '../types'

const PROFILE_STORAGE_KEY = 'l-helper:profile'
const SETTINGS_STORAGE_KEY = 'l-helper:settings'

/** Fallback defaults used when nothing has been persisted yet. */
export const defaultProfile: CandidateProfile = {
  fullName: '',
  roleTitle: '',
  summary: '',
  technicalSkills: [],
  keyAchievements: [],
  customContext: '',
}

export const defaultSettings: AppSettings = {
  apiEndpoint: '',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
  autoSendOnFinal: true,
  systemPromptTemplate: '',
}

function readJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { ...fallback } as T
    const parsed = JSON.parse(raw) as Partial<T>
    return { ...fallback, ...parsed } as T
  } catch (error) {
    console.error(`[storageService] Failed to read "${key}"`, error)
    return { ...fallback } as T
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[storageService] Failed to write "${key}"`, error)
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.error(`[storageService] Failed to remove "${key}"`, error)
  }
}

export function getProfile(): CandidateProfile {
  return readJSON<CandidateProfile>(PROFILE_STORAGE_KEY, defaultProfile)
}

export function saveProfile(profile: CandidateProfile): void {
  writeJSON(PROFILE_STORAGE_KEY, profile)
}

export function clearProfile(): void {
  removeKey(PROFILE_STORAGE_KEY)
}

export function getSettings(): AppSettings {
  return readJSON<AppSettings>(SETTINGS_STORAGE_KEY, defaultSettings)
}

export function saveSettings(settings: AppSettings): void {
  writeJSON(SETTINGS_STORAGE_KEY, settings)
}

export function clearSettings(): void {
  removeKey(SETTINGS_STORAGE_KEY)
}
