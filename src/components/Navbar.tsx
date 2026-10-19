import { Activity, ClipboardList, MessageSquare, PanelRight, PanelRightClose, Settings, Zap } from 'lucide-react'

export type AppTab = 'transcript' | 'answer'

interface NavbarProps {
  isListening: boolean
  transcriptCount: number
  answerCount: number
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  isDrawerOpen: boolean
  onToggleDrawer: () => void
  onOpenSettings: () => void
}

export default function Navbar({
  isListening,
  transcriptCount,
  answerCount,
  activeTab,
  onTabChange,
  isDrawerOpen,
  onToggleDrawer,
  onOpenSettings,
}: NavbarProps) {
  const tabs: { id: AppTab; label: string; icon: typeof ClipboardList }[] = [
    { id: 'transcript', label: 'Transcript', icon: ClipboardList },
    { id: 'answer', label: 'Answer', icon: MessageSquare },
  ]

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

      <nav
        className="ml-1 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1"
        aria-label="View switcher"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const count = tab.id === 'transcript' ? transcriptCount : answerCount
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={15} />
              <span className="hidden md:inline">{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

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
