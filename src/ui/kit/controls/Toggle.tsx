// TOGGLE — an on/off switch. The visible label usually comes from the ListRow it sits in.
type ToggleProps = { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }

export function Toggle({ on, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      className="kit-toggle kit-target"
      aria-checked={on}
      aria-label={label}
      data-state={on ? 'on' : 'off'}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="kit-toggle-track"><span className="kit-toggle-thumb" /></span>
    </button>
  )
}
