import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppSettings, CandidateProfile } from '../types'
import {
  defaultProfile,
  defaultSettings,
  getProfile,
  getSettings,
  saveProfile,
  saveSettings,
} from '../services/storageService'

interface ProfileContextValue {
  profile: CandidateProfile
  settings: AppSettings
  updateProfile: (updates: Partial<CandidateProfile>) => void
  updateSettings: (updates: Partial<AppSettings>) => void
  resetProfile: () => void
  resetSettings: () => void
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CandidateProfile>(() => getProfile())
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())

  // Persist to localStorage whenever state changes.
  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateProfile = useCallback((updates: Partial<CandidateProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [])

  const resetProfile = useCallback(() => {
    setProfile({ ...defaultProfile })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings({ ...defaultSettings })
  }, [])

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, settings, updateProfile, updateSettings, resetProfile, resetSettings }),
    [profile, settings, updateProfile, updateSettings, resetProfile, resetSettings],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
