import type { AudioMode } from '../types'

interface AudioModeSelectorProps {
  value: AudioMode
  onChange: (mode: AudioMode) => void
}

const MODES: Array<{ value: AudioMode; emoji: string; label: string; hint: string }> = [
  { value: 'standard', emoji: '🎤', label: 'Standard Mic', hint: 'Live mic + speech recognition' },
  { value: 'voice-filter', emoji: '🛡️', label: 'Voice Filter', hint: 'Ignore your own voice' },
  { value: 'network-stream', emoji: '🌐', label: 'Network Stream', hint: 'WebSocket audio feed' },
]

export default function AudioModeSelector({ value, onChange }: AudioModeSelectorProps) {
  return (
    <section aria-label="Audio input mode" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div
        role="tablist"
        aria-label="Audio input mode"
        className="scrollbar-thin flex gap-2 overflow-x-auto pb-1"
      >
        {MODES.map((mode) => {
          const selected = mode.value === value
          return (
            <button
              key={mode.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(mode.value)}
              className={`flex min-h-11 min-w-11 shrink-0 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                selected
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span aria-hidden="true">{mode.emoji}</span>
                {mode.label}
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[10px] text-zinc-500">{mode.hint}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
