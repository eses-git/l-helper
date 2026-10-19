import { Check, CircleAlert, LoaderCircle, Sparkles } from 'lucide-react'
import type { AnswerItem } from '../types'

interface AnswerDisplayProps {
  items: AnswerItem[]
}

const STATUS_META: Record<AnswerItem['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
  streaming: { label: 'Streaming', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  complete: { label: 'Complete', className: 'border-zinc-700 bg-zinc-800 text-zinc-300' },
  error: { label: 'Error', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
}

function StatusBadge({ status }: { status: AnswerItem['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.className}`}
    >
      {status === 'streaming' && <LoaderCircle size={12} className="animate-spin" />}
      {status === 'complete' && <Check size={12} />}
      {status === 'error' && <CircleAlert size={12} />}
      {meta.label}
    </span>
  )
}

export default function AnswerDisplay({ items }: AnswerDisplayProps) {
  const current = items[items.length - 1]
  const history = items.slice(0, -1).reverse()

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Sparkles size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Answer</h2>
        <span className="ml-auto text-[11px] text-zinc-500">glanceable</span>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!current && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <Sparkles size={32} className="mb-3 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-500">No answer yet</p>
            <p className="text-sm text-zinc-600">Capture a question to generate a concise answer</p>
          </div>
        )}

        {current && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 border-b border-zinc-800 pb-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Question
              </p>
              <p className="text-sm text-zinc-400">{current.questionText}</p>
            </div>

            <div className="mb-4">
              <StatusBadge status={current.status} />
            </div>

            {current.status === 'error' ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-sm leading-relaxed text-red-200">
                  {current.error ?? 'Something went wrong while generating the answer.'}
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words text-xl font-semibold leading-snug text-zinc-50 lg:text-2xl">
                {current.answerText}
                {current.status === 'streaming' && (
                  <span className="caret-blink ml-0.5 inline-block h-[1.2em] w-[2px] translate-y-[3px] bg-emerald-400" />
                )}
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Previous answers
            </p>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                  <p className="mb-1 text-xs text-zinc-500">{item.questionText}</p>
                  <p
                    className={`whitespace-pre-wrap text-sm leading-relaxed ${
                      item.status === 'error' ? 'text-red-300' : 'text-zinc-300'
                    }`}
                  >
                    {item.status === 'error' ? item.error ?? 'Error' : item.answerText || '…'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
