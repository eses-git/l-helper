interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}

/**
 * Switch with a 44x44px minimum touch target. The visual track/thumb stay
 * compact while the outer button keeps taps comfortable on mobile.
 */
export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Toggle'}
      onClick={() => onChange(!checked)}
      className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <span
        className={`relative h-6 w-12 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
