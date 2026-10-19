import { Mic, MicOff, Trash, Volume2 } from 'lucide-react'
import { speechErrorMessage } from '../hooks/useSpeechRecognition'

interface SpeechControlsProps {
  isSupported: boolean
  isListening: boolean
  error: string | null
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

const LEVEL_BARS = [0.3, 0.5, 0.4, 0.8, 0.6, 0.95, 0.7, 1, 0.55, 0.85, 0.4, 0.65]

function Hotkey({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

export default function SpeechControls({
  isSupported,
  isListening,
  error,
  onStart,
  onStop,
  onReset,
}: SpeechControlsProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isListening ? onStop : onStart}
          disabled={!isSupported}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            isListening
              ? 'border-red-500/40 bg-red-500/15 text-red-400'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          }`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">Live audio listener</h2>
          <p className="truncate text-xs text-zinc-400">
            {!isSupported
              ? 'Not supported in this browser'
              : isListening
                ? 'Capturing speech…'
                : 'Tap the mic to start'}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          title="Clear transcript"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Trash size={14} />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Volume2 size={14} className="shrink-0 text-zinc-500" />
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Mic level</span>
        <div className="ml-1 flex h-5 flex-1 items-end gap-0.5" aria-hidden="true">
          {LEVEL_BARS.map((height, index) => (
            <span
              key={index}
              className={`flex-1 rounded-sm ${isListening ? 'animate-pulse bg-emerald-400/80' : 'bg-zinc-700'}`}
              style={{ height: `${height * 100}%`, animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium ${isListening ? 'text-emerald-400' : 'text-zinc-500'}`}
        >
          {isListening ? 'Active' : 'Standby'}
        </span>
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
          {speechErrorMessage(error)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-2.5">
        <Hotkey keys={['Space']} label="Listen" />
        <Hotkey keys={['Esc']} label="Cancel" />
        <Hotkey keys={['C']} label="Copy" />
      </div>
    </section>
  )
}
