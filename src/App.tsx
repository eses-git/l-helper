import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Settings, X } from 'lucide-react'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import type { AnswerItem, TranscriptItem } from './types'
import Navbar, { type AppTab } from './components/Navbar'
import SpeechControls from './components/SpeechControls'
import TranscriptView from './components/TranscriptView'
import AnswerDisplay from './components/AnswerDisplay'
import ProfileManager from './components/ProfileManager'
import SettingsModal from './components/SettingsModal'
import { streamAnswer } from './services/apiService'

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
  const [activeTab, setActiveTab] = useState<AppTab>('transcript')
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([])
  const [answerItems, setAnswerItems] = useState<AnswerItem[]>([])
  const [copied, setCopied] = useState(false)
  const abortControllersRef = useRef<AbortController[]>([])
  const isListeningRef = useRef(false)
  const answerItemsRef = useRef<AnswerItem[]>([])
  const isSettingsOpenRef = useRef(false)

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

  const {
    isSupported,
    isListening,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ onFinalResult: handleFinalResult })

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  const clearTranscript = useCallback(() => {
    resetTranscript()
    setTranscriptItems([])
  }, [resetTranscript])

  // Keep refs in sync for the (stable) global hotkey handler.
  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    answerItemsRef.current = answerItems
  }, [answerItems])

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen
  }, [isSettingsOpen])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

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
      // Suppress global hotkeys while a modal dialog is open.
      if (isSettingsOpenRef.current) return
      const target = event.target as HTMLElement | null
      if (target && isEditableTarget(target)) return

      if (event.code === 'Space') {
        // Avoid double-toggling when focus is on a button (Space "clicks" buttons).
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Navbar
        isListening={isListening}
        transcriptCount={transcriptItems.length}
        answerCount={answerItems.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="mx-auto w-full max-w-[1600px] flex-1">
        <main className="grid h-full grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section
            className={`min-h-0 flex-col gap-4 ${activeTab === 'transcript' ? 'flex' : 'hidden lg:flex'}`}
          >
            <SpeechControls
              isSupported={isSupported}
              isListening={isListening}
              error={error}
              onStart={startListening}
              onStop={stopListening}
              onReset={resetTranscript}
            />
            <TranscriptView
              items={transcriptItems}
              interimText={interimTranscript}
              isListening={isListening}
              autoSendOnFinal={settings.autoSendOnFinal}
              onToggleAutoSend={(value) => updateSettings({ autoSendOnFinal: value })}
              onClear={clearTranscript}
              onGenerate={(item) => generateAnswer(item.id, item.text)}
            />
          </section>

          <section
            className={`min-h-0 flex-col gap-4 ${activeTab === 'answer' ? 'flex' : 'hidden lg:flex'}`}
          >
            <AnswerDisplay items={answerItems} />
          </section>
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
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
