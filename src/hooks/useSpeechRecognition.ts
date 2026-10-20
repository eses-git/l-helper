import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Minimal Web Speech API typings (not provided by lib.dom).
// ---------------------------------------------------------------------------

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionGlobal {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as SpeechRecognitionGlobal
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Maps a raw SpeechRecognition error code to a human-readable message. */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access denied. Enable microphone permissions in the browser.'
    case 'audio-capture':
      return 'No microphone detected. Check that a microphone is connected.'
    case 'no-speech':
      return 'No speech detected. Try speaking again.'
    case 'network':
      return 'Speech recognition network error. Check your connection.'
    case 'aborted':
      return 'Listening stopped.'
    case 'not-supported':
      return 'Speech recognition is not supported in this browser.'
    default:
      return 'Speech recognition error.'
  }
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag for recognition. Defaults to 'en-US'. */
  lang?: string
  /**
   * Called when a debounced, validated final utterance is ready.
   * Fires only if the utterance has at least `minWords` words.
   */
  onFinalResult?: (finalText: string) => void
  /**
   * Optional gate applied right before `onFinalResult` fires. When provided and
   * it returns `false`, the utterance is dropped (used by the voice filter).
   */
  filterFinal?: (text: string) => boolean
  /** Minimum word count required before `onFinalResult` fires. Defaults to 3. */
  minWords?: number
  /** Silence window (ms) to wait after `isFinal` before emitting. Defaults to 800. */
  finalDebounceMs?: number
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = 'en-US', onFinalResult, filterFinal, minWords = 3, finalDebounceMs = 800 } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const onFinalResultRef = useRef(onFinalResult)
  const filterFinalRef = useRef(filterFinal)
  const pendingFinalRef = useRef('')
  const finalDebounceTimerRef = useRef<number | null>(null)
  const minWordsRef = useRef(minWords)
  const finalDebounceMsRef = useRef(finalDebounceMs)

  const isSupported = getSpeechRecognitionCtor() !== undefined

  // Keep the latest callback/options available to the (stable) recognition handlers.
  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  }, [onFinalResult])

  useEffect(() => {
    filterFinalRef.current = filterFinal
  }, [filterFinal])

  useEffect(() => {
    minWordsRef.current = minWords
    finalDebounceMsRef.current = finalDebounceMs
  }, [minWords, finalDebounceMs])

  const clearPendingFinal = useCallback(() => {
    pendingFinalRef.current = ''
    if (finalDebounceTimerRef.current !== null) {
      window.clearTimeout(finalDebounceTimerRef.current)
      finalDebounceTimerRef.current = null
    }
  }, [])

  const emitPendingFinal = useCallback(() => {
    const text = pendingFinalRef.current.trim()
    clearPendingFinal()
    if (!text) return
    if (text.split(/\s+/).filter(Boolean).length < minWordsRef.current) return
    if (filterFinalRef.current && !filterFinalRef.current(text)) return
    onFinalResultRef.current?.(text)
  }, [clearPendingFinal])

  const scheduleFinalDebounce = useCallback(() => {
    if (finalDebounceTimerRef.current !== null) {
      window.clearTimeout(finalDebounceTimerRef.current)
    }
    finalDebounceTimerRef.current = window.setTimeout(() => {
      finalDebounceTimerRef.current = null
      emitPendingFinal()
    }, finalDebounceMsRef.current)
  }, [emitPendingFinal])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    setIsListening(false)
    clearRestartTimer()
    // Flush any debounced final so the last utterance is not lost on manual stop.
    emitPendingFinal()
    try {
      recognitionRef.current?.stop()
    } catch {
      // The recognizer may already be stopped.
    }
  }, [clearRestartTimer, emitPendingFinal])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('not-supported')
      return
    }

    shouldListenRef.current = true
    setIsListening(true)
    setError(null)

    if (!recognitionRef.current) {
      const recognition = new Ctor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = lang
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = ''
        let final = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0]?.transcript ?? ''
          if (result.isFinal) {
            final += text
          } else {
            interim += text
          }
        }

        const trimmedFinal = final.trim()
        if (trimmedFinal) {
          pendingFinalRef.current = pendingFinalRef.current
            ? `${pendingFinalRef.current} ${trimmedFinal}`
            : trimmedFinal
          setTranscript((prev) => (prev ? `${prev} ${trimmedFinal}` : trimmedFinal))
        }

        const trimmedInterim = interim.trim()
        setInterimTranscript(trimmedInterim)

        // Any new speech (final or interim) resets the debounce window.
        if (trimmedFinal || trimmedInterim) {
          scheduleFinalDebounce()
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = event.error ?? 'unknown'
        setError(code)

        // Fatal permission errors: give up instead of restarting forever.
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          shouldListenRef.current = false
          setIsListening(false)
          clearRestartTimer()
        }
      }

      recognition.onend = () => {
        setInterimTranscript('')

        // Gracefully auto-restart if we are still supposed to be listening.
        if (shouldListenRef.current) {
          clearRestartTimer()
          restartTimerRef.current = window.setTimeout(() => {
            if (shouldListenRef.current) {
              try {
                recognitionRef.current?.start()
              } catch {
                // The recognizer may already be running.
              }
            }
          }, 250)
        } else {
          setIsListening(false)
        }
      }

      recognitionRef.current = recognition
    }

    try {
      recognitionRef.current.start()
    } catch {
      // Some browsers throw when start() is called while already running.
    }
  }, [lang, clearRestartTimer, scheduleFinalDebounce])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    clearPendingFinal()
  }, [clearPendingFinal])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false
      clearRestartTimer()
      clearPendingFinal()
      try {
        recognitionRef.current?.abort()
      } catch {
        // Ignore abort failures during teardown.
      }
    }
  }, [clearRestartTimer, clearPendingFinal])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  }
}
