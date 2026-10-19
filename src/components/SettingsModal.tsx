import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Check, CircleAlert, Cpu, KeyRound, LoaderCircle, SlidersHorizontal, X } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { streamAnswer } from '../services/apiService'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

const MODEL_OPTIONS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4.1',
  'claude-3-5-sonnet',
  'claude-3-7-sonnet',
  'gemini-2.0-flash',
]

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/60'

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail'

interface CheckItem {
  id: 'mic' | 'context' | 'api'
  label: string
  status: CheckStatus
  message: string
}

const TEST_PROMPT = 'Confirm readiness: return 2 bullet points on web performance'

function statusTextClass(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return 'text-emerald-400'
    case 'fail':
      return 'text-red-400'
    case 'running':
      return 'text-amber-400'
    default:
      return 'text-zinc-500'
  }
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <Check size={16} className="shrink-0 text-emerald-400" />
  if (status === 'fail') return <CircleAlert size={16} className="shrink-0 text-red-400" />
  if (status === 'running') return <LoaderCircle size={16} className="shrink-0 animate-spin text-amber-400" />
  return <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-700" />
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { profile, settings, updateSettings, resetSettings } = useProfile()
  const [isCheckOpen, setIsCheckOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'mic', label: 'Microphone & speech recognition', status: 'idle', message: 'Not run yet' },
    { id: 'context', label: 'Candidate context', status: 'idle', message: 'Not run yet' },
    { id: 'api', label: 'API streaming', status: 'idle', message: 'Not run yet' },
  ])

  const updateCheck = (id: CheckItem['id'], patch: Partial<CheckItem>) => {
    setChecks((prev) => prev.map((check) => (check.id === id ? { ...check, ...patch } : check)))
  }

  const runMicTest = async () => {
    updateCheck('mic', { status: 'running', message: 'Checking…' })

    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      updateCheck('mic', {
        status: 'fail',
        message: 'Speech recognition is not supported in this browser. Use a recent Chrome or Edge.',
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      updateCheck('mic', {
        status: 'fail',
        message: 'Microphone API unavailable — the app must be served over HTTPS.',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      updateCheck('mic', { status: 'pass', message: 'Speech recognition available and microphone access granted.' })
    } catch {
      updateCheck('mic', {
        status: 'fail',
        message: 'Microphone permission denied. Allow mic access in the browser and retry.',
      })
    }
  }

  const runContextTest = () => {
    updateCheck('context', { status: 'running', message: 'Checking…' })
    const hasSummary = profile.summary.trim().length > 0
    const hasSkills = profile.technicalSkills.length > 0
    if (hasSummary || hasSkills) {
      updateCheck('context', { status: 'pass', message: 'Candidate context is present.' })
    } else {
      updateCheck('context', {
        status: 'fail',
        message: 'No candidate context found. Add a summary or technical skills in the Profile panel.',
      })
    }
  }

  const runApiTest = () => {
    return new Promise<void>((resolve) => {
      updateCheck('api', { status: 'running', message: 'Streaming a test prompt…' })

      if (!settings.apiKey.trim() || !settings.apiEndpoint.trim()) {
        updateCheck('api', { status: 'fail', message: 'API key or endpoint is missing. Add them above and retry.' })
        resolve()
        return
      }

      let receivedChunks = 0
      let settled = false
      let timeoutId: number | null = null
      const controller = new AbortController()

      const finish = (status: CheckStatus, message: string) => {
        if (settled) return
        settled = true
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        updateCheck('api', { status, message })
        resolve()
      }

      timeoutId = window.setTimeout(() => {
        controller.abort()
        finish('fail', 'API stream timed out. Check the endpoint URL and network connection.')
      }, 15000)

      void streamAnswer({
        question: TEST_PROMPT,
        profile,
        settings,
        signal: controller.signal,
        onChunk: () => {
          receivedChunks += 1
        },
        onError: (error) => {
          finish('fail', `API stream failed: ${error.message}`)
        },
        onComplete: () => {
          if (receivedChunks > 0) {
            finish('pass', 'API streaming works — received a streamed response.')
          } else {
            finish('fail', 'API responded but returned no streamed content.')
          }
        },
      })
    })
  }

  const runDiagnostic = async () => {
    setIsRunning(true)
    setChecks([
      { id: 'mic', label: 'Microphone & speech recognition', status: 'running', message: 'Checking…' },
      { id: 'context', label: 'Candidate context', status: 'running', message: 'Checking…' },
      { id: 'api', label: 'API streaming', status: 'running', message: 'Checking…' },
    ])

    await runMicTest()
    runContextTest()
    await runApiTest()

    setIsRunning(false)
  }

  const openAndRun = () => {
    setIsCheckOpen(true)
    if (!isRunning) void runDiagnostic()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isCheckOpen) {
        setIsCheckOpen(false)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isCheckOpen, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4">
          <SlidersHorizontal size={18} className="text-emerald-400" />
          <h2 className="text-base font-semibold text-zinc-50">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <Field label="API endpoint URL">
            <input
              className={inputClass}
              value={settings.apiEndpoint}
              onChange={(e) => updateSettings({ apiEndpoint: e.target.value })}
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </Field>

          <Field label="API key">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="shrink-0 text-zinc-500" />
              <input
                type="password"
                className={inputClass}
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                placeholder="sk-…"
              />
            </div>
          </Field>

          <Field label="Model">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="shrink-0 text-zinc-500" />
              <select
                className={`${inputClass} appearance-none`}
                value={settings.modelName}
                onChange={(e) => updateSettings({ modelName: e.target.value })}
              >
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model} className="bg-zinc-900">
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label={`Temperature — ${settings.temperature.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.temperature}
              onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
            <span className="text-sm text-zinc-200">Auto-send on final</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSendOnFinal}
              onClick={() => updateSettings({ autoSendOnFinal: !settings.autoSendOnFinal })}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                settings.autoSendOnFinal ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.autoSendOnFinal ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <Field label="System prompt template">
            <textarea
              className={`${inputClass} resize-none`}
              rows={6}
              value={settings.systemPromptTemplate}
              onChange={(e) => updateSettings({ systemPromptTemplate: e.target.value })}
              placeholder="Optional custom instructions — prepended to the built-in co-pilot prompt"
            />
          </Field>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={resetSettings}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAndRun}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              <Activity size={15} />
              Run System Check
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Done
            </button>
          </div>
        </footer>
      </div>

      {isCheckOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsCheckOpen(false)}
          />
          <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <header className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4">
              <Activity size={18} className="text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-50">System check</h2>
              <button
                type="button"
                onClick={() => setIsCheckOpen(false)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
                aria-label="Close system check"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-3 px-5 py-5">
              {checks.map((check) => (
                <div key={check.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={check.status} />
                    <span className="text-sm font-medium text-zinc-100">{check.label}</span>
                    <span
                      className={`ml-auto text-[11px] font-medium uppercase tracking-wide ${statusTextClass(check.status)}`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{check.message}</p>
                </div>
              ))}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
              <button
                type="button"
                onClick={() => void runDiagnostic()}
                disabled={isRunning}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run again
              </button>
              <button
                type="button"
                onClick={() => setIsCheckOpen(false)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
