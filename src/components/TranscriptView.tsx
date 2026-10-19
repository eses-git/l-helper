import { useEffect, useRef } from 'react'
import { ListChecks, Send, Trash } from 'lucide-react'
import type { TranscriptItem } from '../types'

interface TranscriptViewProps {
  items: TranscriptItem[]
  interimText: string
  isListening: boolean
  autoSendOnFinal: boolean
  onToggleAutoSend: (value: boolean) => void
  onClear: () => void
  onGenerate: (item: TranscriptItem) => void
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function TranscriptView({
  items,
  interimText,
  isListening,
  autoSendOnFinal,
  onToggleAutoSend,
  onClear,
  onGenerate,
}: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items.length, interimText])

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Question feed</h2>
        </div>

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
          <span>Auto-send</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoSendOnFinal}
            onClick={() => onToggleAutoSend(!autoSendOnFinal)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              autoSendOnFinal ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                autoSendOnFinal ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>

        <button
          type="button"
          onClick={onClear}
          title="Clear transcript"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Trash size={13} />
          Clear
        </button>
      </header>

      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 && !interimText && (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <ListChecks size={28} className="mb-2 text-zinc-700" />
            <p className="text-sm text-zinc-500">No questions captured yet</p>
            <p className="text-xs text-zinc-600">Start listening to stream live questions here</p>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  item.speaker === 'interviewer'
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'bg-violet-500/15 text-violet-300'
                }`}
              >
                {item.speaker}
              </span>
              <span className="text-[10px] text-zinc-500">{formatTime(item.timestamp)}</span>
              {!autoSendOnFinal && item.speaker === 'interviewer' && (
                <button
                  type="button"
                  onClick={() => onGenerate(item)}
                  className="ml-auto flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <Send size={11} />
                  Ask
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-zinc-200">{item.text}</p>
          </div>
        ))}

        {interimText && (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
                interviewer
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                listening
              </span>
            </div>
            <p className="text-sm italic leading-relaxed text-zinc-400">{interimText}…</p>
          </div>
        )}
      </div>

      {!isListening && items.length === 0 && (
        <p className="border-t border-zinc-800 px-4 py-2 text-center text-[11px] text-zinc-500">
          Speak clearly — final questions are captured automatically
        </p>
      )}
    </section>
  )
}
