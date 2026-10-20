import { Activity, MessageSquare, PanelRight, PanelRightClose, Settings, Sparkles, Zap } from 'lucide-react'

interface NavbarProps {
  isListening: boolean
  transcriptCount: number
  answerCount: number
  isDrawerOpen: boolean
  onToggleDrawer: () => void
  onOpenSettings: () => void
}

export default function Navbar({
  isListening,
  transcriptCount,
  answerCount,
  isDrawerOpen,
  onToggleDrawer,
  onOpenSettings,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-3 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Zap size={18} strokeWidth={2.5} />
        </span>
        <div className="hidden leading-tight sm:block">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-50">l-helper</h1>
          <p className="text-[11px] text-zinc-400">Interview co-pilot</p>
        </div>
      </div>

      <div className="ml-1 flex items-center gap-1.5">
        <span
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400"
          title="Questions captured"
        >
          <MessageSquare size={12} className="text-cyan-300" />
          {transcriptCount}
        </span>
        <span
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400"
          title="Answers generated"
        >
          <Sparkles size={12} className="text-emerald-300" />
          {answerCount}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            isListening
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400'
          }`}
        >
          <Activity size={13} className={isListening ? 'animate-pulse' : ''} />
          {isListening ? 'Live' : 'Idle'}
        </span>

        <button
          type="button"
          onClick={onToggleDrawer}
          title="Toggle profile panel"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          {isDrawerOpen ? <PanelRightClose size={17} /> : <PanelRight size={17} />}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Open settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  )
}
