import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { Brain, CircleAlert, CircleCheck, Download, ListChecks, SquarePen, Trash, Upload, User, X } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import type { AppSettings, CandidateProfile } from '../types'

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/60'

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-300">
      <span className="text-emerald-400">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
      <span className="flex-1 border-t border-zinc-800" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function extractProfileFields(value: unknown): Partial<CandidateProfile> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  const updates: Partial<CandidateProfile> = {}

  if (typeof obj.fullName === 'string') updates.fullName = obj.fullName
  if (typeof obj.roleTitle === 'string') updates.roleTitle = obj.roleTitle
  if (typeof obj.summary === 'string') updates.summary = obj.summary
  if (Array.isArray(obj.technicalSkills) && obj.technicalSkills.every((s) => typeof s === 'string')) {
    updates.technicalSkills = obj.technicalSkills as string[]
  }
  if (Array.isArray(obj.keyAchievements) && obj.keyAchievements.every((a) => typeof a === 'string')) {
    updates.keyAchievements = obj.keyAchievements as string[]
  }
  if (typeof obj.customContext === 'string') updates.customContext = obj.customContext

  return Object.keys(updates).length > 0 ? updates : null
}

function isBackup(value: unknown): value is { profile: Record<string, unknown>; settings: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.profile === 'object' && obj.profile !== null && !Array.isArray(obj.profile) &&
    typeof obj.settings === 'object' && obj.settings !== null && !Array.isArray(obj.settings)
  )
}

export default function ProfileManager() {
  const { profile, settings, updateProfile, updateSettings, resetProfile } = useProfile()
  const [skillInput, setSkillInput] = useState('')
  const [achievementInput, setAchievementInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const statusTimerRef = useRef<number | null>(null)

  const addSkill = () => {
    const value = skillInput.trim()
    if (!value) return
    if (!profile.technicalSkills.includes(value)) {
      updateProfile({ technicalSkills: [...profile.technicalSkills, value] })
    }
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    updateProfile({ technicalSkills: profile.technicalSkills.filter((s) => s !== skill) })
  }

  const addAchievement = () => {
    const value = achievementInput.trim()
    if (!value) return
    updateProfile({ keyAchievements: [...profile.keyAchievements, value] })
    setAchievementInput('')
  }

  const removeAchievement = (achievement: string) => {
    updateProfile({ keyAchievements: profile.keyAchievements.filter((a) => a !== achievement) })
  }

  const showStatus = (type: 'success' | 'error', message: string) => {
    setUploadStatus({ type, message })
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setUploadStatus(null), 3500)
  }

  const applyText = (content: string, fileName: string) => {
    const trimmed = content.trim()
    if (!trimmed) {
      showStatus('error', 'File is empty.')
      return
    }
    updateProfile({
      customContext: profile.customContext
        ? `${profile.customContext}\n\n--- ${fileName} ---\n${trimmed}`
        : `--- ${fileName} ---\n${trimmed}`,
    })
    showStatus('success', `Context loaded from ${fileName}`)
  }

  const applyJson = (content: string, fileName: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      showStatus('error', 'Invalid JSON file.')
      return
    }

    if (isBackup(parsed)) {
      updateProfile(parsed.profile as Partial<CandidateProfile>)
      updateSettings(parsed.settings as Partial<AppSettings>)
      showStatus('success', `Backup restored from ${fileName}`)
      return
    }

    const updates = extractProfileFields(parsed)
    if (updates) {
      updateProfile(updates)
      showStatus('success', `Profile filled from ${fileName}`)
    } else {
      applyText(JSON.stringify(parsed, null, 2), fileName)
    }
  }

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const reader = new FileReader()

    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      if (!content) {
        showStatus('error', 'Could not read file.')
        return
      }
      if (ext === 'json') {
        applyJson(content, file.name)
      } else {
        applyText(content, file.name)
      }
    }
    reader.onerror = () => showStatus('error', 'Failed to read file.')
    reader.readAsText(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFile(file)
    event.target.value = ''
  }

  const exportProfile = () => {
    const payload = {
      app: 'l-helper',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      settings,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `l-helper-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showStatus('success', 'Profile backup exported.')
  }

  // Clear the status timer on unmount.
  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-950/40'
        }`}
      >
        <Upload size={20} className={dragging ? 'text-emerald-400' : 'text-zinc-500'} />
        <p className="text-xs text-zinc-400">
          Drop a resume or context file
          <br />
          <span className="text-zinc-600">.txt · .md · .json</span>
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          Browse files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.json,text/plain,text/markdown,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {uploadStatus && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            uploadStatus.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {uploadStatus.type === 'success' ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
          <span className="flex-1">{uploadStatus.message}</span>
        </div>
      )}

      <div className="space-y-3">
        <SectionTitle icon={<User size={14} />} title="Identity" />
        <Field label="Full name">
          <input
            className={inputClass}
            value={profile.fullName}
            onChange={(e) => updateProfile({ fullName: e.target.value })}
            placeholder="e.g. Alex Morgan"
          />
        </Field>
        <Field label="Role title">
          <input
            className={inputClass}
            value={profile.roleTitle}
            onChange={(e) => updateProfile({ roleTitle: e.target.value })}
            placeholder="e.g. Senior Frontend Engineer"
          />
        </Field>
        <Field label="Summary">
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={profile.summary}
            onChange={(e) => updateProfile({ summary: e.target.value })}
            placeholder="One or two lines about the candidate"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={<ListChecks size={14} />} title="Technical skills" />
        <div className="flex flex-wrap gap-1.5">
          {profile.technicalSkills.map((skill) => (
            <span
              key={skill}
              className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-zinc-500 hover:text-zinc-200"
                aria-label={`Remove ${skill}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {profile.technicalSkills.length === 0 && (
            <p className="text-xs text-zinc-500">No skills added</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSkill()
              }
            }}
            placeholder="Add a skill"
          />
          <button
            type="button"
            onClick={addSkill}
            className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={<SquarePen size={14} />} title="Key wins" />
        <ul className="space-y-2">
          {profile.keyAchievements.map((achievement) => (
            <li
              key={achievement}
              className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex-1">{achievement}</span>
              <button
                type="button"
                onClick={() => removeAchievement(achievement)}
                className="text-zinc-500 hover:text-zinc-200"
                aria-label="Remove achievement"
              >
                <Trash size={13} />
              </button>
            </li>
          ))}
          {profile.keyAchievements.length === 0 && (
            <p className="text-xs text-zinc-500">No achievements added</p>
          )}
        </ul>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={achievementInput}
            onChange={(e) => setAchievementInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAchievement()
              }
            }}
            placeholder="Add a key win"
          />
          <button
            type="button"
            onClick={addAchievement}
            className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={<Brain size={14} />} title="Custom context" />
        <textarea
          className={`${inputClass} resize-none`}
          rows={4}
          value={profile.customContext}
          onChange={(e) => updateProfile({ customContext: e.target.value })}
          placeholder="Extra context or custom rules for the co-pilot…"
        />
      </div>

      <button
        type="button"
        onClick={exportProfile}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        <Download size={14} />
        Export backup (JSON)
      </button>

      <button
        type="button"
        onClick={resetProfile}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
      >
        <Trash size={14} />
        Reset profile
      </button>
    </div>
  )
}
