import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Settings, X } from 'lucide-react'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { useSpeechRecognition, speechErrorMessage } from './hooks/useSpeechRecognition'
import type { AnswerItem, AudioMode, TranscriptItem, VoiceFilterState } from './types'
import Navbar from './components/Navbar'
import AudioModeSelector from './components/AudioModeSelector'
import SpeechControls from './components/SpeechControls'
import TranscriptView from './components/TranscriptView'
import ProfileManager from './components/ProfileManager'
import SettingsModal from './components/SettingsModal'
import { streamAnswer } from './services/apiService'
import { getVoiceProfile, startVoiceFilterMonitoring } from './services/audioProcessingService'
import { connectNetworkStream } from './services/networkStreamService'
import type { NetworkStreamConnection, NetworkStreamStatus } from './services/networkStreamService'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isEditableTarget(target: HTMLElement): boolean {
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function AppShell() {
  const { profile, settings, updateSettings } = useProfile()
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([])
  const [answerItems, setAnswerItems] = useState<AnswerItem[]>([])
  const [copied, setCopied] = useState(false)
  const [networkActive, setNetworkActive] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<NetworkStreamStatus>('disconnected')
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [voiceFilterState, setVoiceFilterState] = useState<VoiceFilterState>('idle')

  const abortControllersRef = useRef<AbortController[]>([])
  const isActiveRef = useRef(false)
  const answerItemsRef = useRef<AnswerItem[]>([])
  const isSettingsOpenRef = useRef(false)
  const audioModeRef = useRef<AudioMode>(settings.audioMode)
  const networkConnRef = useRef<NetworkStreamConnection | null>(null)
  const voiceFilterIsSelfRef = useRef(false)

  const audioMode = settings.audioMode

  const generateAnswer = useCallback(
    (questionId: string, questionText: string) => {
      const answerId = createId()

      setAnswerItems((prev) => [
        ...prev,
        { id: answerId, questionId, questionText, answerText: '', status: 'streaming', timestamp: Date.now() },
      ])

      const controller = new AbortController()
      abortControllersRef.current.push(controller)

      void streamAnswer({
        question: questionText,
        profile,
        settings,
        signal: controller.signal,
        onChunk: (chunk) => {
          setAnswerItems((prev) =>
            prev.map((item) =>
              item.id === answerId ? { ...item, answerText: item.answerText + chunk } : item,
            ),
          )
        },
        onError: (err) => {
          setAnswerItems((prev) =>
            prev.map((item) =>
              item.id === answerId ? { ...item, status: 'error', error: err.message } : item,
            ),
          )
        },
        onComplete: () => {
          setAnswerItems((prev) =>
            prev.map((item) =>
              item.id === answerId && item.status !== 'error'
                ? { ...item, status: 'complete' }
                : item,
            ),
          )
        },
      })
    },
    [profile, settings],
  )

  const handleFinalResult = useCallback(
    (finalText: string) => {
      const item: TranscriptItem = {
        id: createId(),
        text: finalText,
        timestamp: Date.now(),
        isFinal: true,
        speaker: 'interviewer',
      }
      setTranscriptItems((prev) => [...prev, item])
      if (settings.autoSendOnFinal) {
        generateAnswer(item.id, finalText)
      }
    },
    [settings.autoSendOnFinal, generateAnswer],
  )

  const filterFinal = useCallback((): boolean => {
    if (audioModeRef.current !== 'voice-filter') return true
    return !voiceFilterIsSelfRef.current
  }, [])

  const {
    isSupported,
    isListening,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ onFinalResult: handleFinalResult, filterFinal })

  const clearTranscript = useCallback(() => {
    resetTranscript()
    setTranscriptItems([])
  }, [resetTranscript])

  const isActive = audioMode === 'network-stream' ? networkActive : isListening

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  // Keep refs in sync for the (stable) global hotkey handler and callbacks.
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    answerItemsRef.current = answerItems
  }, [answerItems])

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen
  }, [isSettingsOpen])

  useEffect(() => {
    audioModeRef.current = audioMode
  }, [audioMode])

  const startNetworkStream = useCallback(() => {
    const url = settings.networkStreamUrl.trim()
    if (!url) {
      setNetworkError('No network stream URL configured. Add one in Settings.')
      return
    }
    setNetworkError(null)
    setNetworkStatus('connecting')
    const connection = connectNetworkStream(url, {
      onTranscript: handleFinalResult,
      onStatusChange: setNetworkStatus,
      onError: (message) => setNetworkError(message),
    })
    networkConnRef.current = connection
    setNetworkActive(true)
  }, [settings.networkStreamUrl, handleFinalResult])

  const stopNetworkStream = useCallback(() => {
    networkConnRef.current?.close()
    networkConnRef.current = null
    setNetworkActive(false)
    setNetworkStatus('disconnected')
  }, [])

  const toggleListening = useCallback(() => {
    if (isActiveRef.current) {
      if (audioModeRef.current === 'network-stream') stopNetworkStream()
      else stopListening()
    } else if (audioModeRef.current === 'network-stream') {
      startNetworkStream()
    } else {
      startListening()
    }
  }, [startListening, stopListening, startNetworkStream, stopNetworkStream])

  // Stop the previous input source whenever the mode changes.
  useEffect(() => {
    stopListening()
    stopNetworkStream()
  }, [audioMode, stopListening, stopNetworkStream])

  // Voice filter: monitor the mic and classify self vs. external speaker.
  useEffect(() => {
    if (audioMode !== 'voice-filter' || !isListening) {
      voiceFilterIsSelfRef.current = false
      setVoiceFilterState('idle')
      return
    }

    const profile = getVoiceProfile()
    if (!profile) {
      voiceFilterIsSelfRef.current = false
      setVoiceFilterState('no-profile')
      return
    }

    let disposed = false
    let cleanup: (() => void) | null = null
    let lastIsSelf: boolean | null = null

    void startVoiceFilterMonitoring(profile, settings.voiceMatchThreshold, (isSelf) => {
      if (disposed) return
      voiceFilterIsSelfRef.current = isSelf
      if (lastIsSelf !== isSelf) {
        lastIsSelf = isSelf
        setVoiceFilterState(isSelf ? 'self' : 'external')
      }
    })
      .then((dispose) => {
        if (disposed) dispose()
        else cleanup = dispose
      })
      .catch(() => {
        if (!disposed) setVoiceFilterState('idle')
      })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [audioMode, isListening, settings.voiceMatchThreshold])

  const cancelActive = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort())
    abortControllersRef.current = []
    setAnswerItems((prev) =>
      prev.map((item) => (item.status === 'streaming' ? { ...item, status: 'complete' } : item)),
    )
    clearTranscript()
  }, [clearTranscript])

  const copyLatestAnswer = useCallback(() => {
    const items = answerItemsRef.current
    for (let i = items.length - 1; i >= 0; i--) {
      const text = items[i].answerText.trim()
      if (!text) continue
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {
          // Clipboard write failed; still surface the confirmation below.
        })
      }
      setCopied(true)
      return
    }
  }, [])

  // Auto-hide the copy confirmation toast.
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  // Global hotkeys (ignored while typing in form fields).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSettingsOpenRef.current) return
      const target = event.target as HTMLElement | null
      if (target && isEditableTarget(target)) return

      if (event.code === 'Space') {
        if (target && target.tagName === 'BUTTON') return
        event.preventDefault()
        toggleListening()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelActive()
        return
      }
      if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        copyLatestAnswer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleListening, cancelActive, copyLatestAnswer])

  const displayError =
    audioMode === 'network-stream' ? networkError : error ? speechErrorMessage(error) : null
  const hasVoiceProfile = getVoiceProfile() !== null

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Navbar
        isListening={isActive}
        transcriptCount={transcriptItems.length}
        answerCount={answerItems.length}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="mx-auto w-full max-w-4xl flex-1">
        <main className="flex h-full flex-col gap-3 p-3 sm:gap-4 sm:p-4">
          <AudioModeSelector value={audioMode} onChange={(mode) => updateSettings({ audioMode: mode })} />
          <SpeechControls
            isSupported={isSupported}
            isListening={isActive}
            errorMessage={displayError}
            mode={audioMode}
            hasVoiceProfile={hasVoiceProfile}
            hasStreamUrl={settings.networkStreamUrl.trim().length > 0}
            networkStatus={networkStatus}
            filterState={voiceFilterState}
            onStart={toggleListening}
            onStop={toggleListening}
            onReset={resetTranscript}
          />
          <TranscriptView
            items={transcriptItems}
            answerItems={answerItems}
            interimText={interimTranscript}
            isListening={isActive}
            autoSendOnFinal={settings.autoSendOnFinal}
            onToggleAutoSend={(value) => updateSettings({ autoSendOnFinal: value })}
            onClear={clearTranscript}
            onGenerate={(item) => generateAnswer(item.id, item.text)}
          />
        </main>
      </div>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-300 ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-50">Profile & context</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
            aria-label="Close profile panel"
          >
            <X size={16} />
          </button>
        </header>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          <ProfileManager />
        </div>
        <footer className="border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            <Settings size={16} />
            Settings
          </button>
        </footer>
      </aside>

      <SettingsModal open={isSettingsOpen} onClose={() => setSettingsOpen(false)} />

      {copied && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-500/30 bg-zinc-900 px-4 py-2 text-sm text-emerald-300 shadow-lg">
          <Check size={15} />
          Answer copied to clipboard
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ProfileProvider>
      <AppShell />
    </ProfileProvider>
  )
}
