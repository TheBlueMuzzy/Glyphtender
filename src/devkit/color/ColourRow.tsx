// One colour row: [● name] [swatch = colour picker] [#hex] [↺] — used by the Color tab, and free for game tabs:
//   import { ColourRow } from '../devkit/color/ColourRow'   (looks: color.css, imported by the Color tab)
import { useState, type ReactNode } from 'react'
import { normalizeHex, sameColour } from './colorLogic'

type RowProps = {
  label: string // the name, also read out by screen readers
  display?: ReactNode // what to show instead of the plain label (e.g. with search highlights)
  value: string
  changed: boolean // shows the "changed, not saved yet" dot
  resetTo: string // what ↺ puts back
  resetHint: string // e.g. "Back to the saved file"
  onChange: (value: string) => void
}

export function ColourRow({ label, display, value, changed, resetTo, resetHint, onChange }: RowProps) {
  const hex = normalizeHex(value) // null for values like "transparent" — the picker can't show those
  return (
    <div className="ct-row">
      <span className="ct-label">
        {changed && <span className="ct-dot" title="Changed, not saved yet" />}
        {display ?? label}
      </span>
      <input
        className="ct-swatch"
        type="color"
        value={hex ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} — pick a colour`}
        title="Pick a colour"
      />
      <HexField value={value} label={label} onChange={onChange} />
      <button
        className="ct-reset"
        disabled={sameColour(value, resetTo)}
        onClick={() => onChange(resetTo)}
        title={`${resetHint}: ${resetTo}`}
        aria-label={`Reset ${label} — ${resetHint.toLowerCase()} (${resetTo})`}
      >
        ↺
      </button>
    </div>
  )
}

/** A text box for typing a hex colour. Only a valid colour is passed on; a bad one shows red. */
function HexField({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  // When the colour changes elsewhere (picker, ↺), the text box follows it
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }
  const valid = normalizeHex(draft) !== null || draft.trim() === 'transparent'
  const commit = () => {
    const hex = normalizeHex(draft)
    if (hex && hex !== value) onChange(hex)
    else if (draft.trim() === 'transparent' && value !== 'transparent') onChange('transparent')
  }
  return (
    <input
      className={`ct-hex${valid ? '' : ' is-bad'}`}
      value={draft}
      spellCheck={false}
      autoCapitalize="off"
      onChange={(e) => {
        setDraft(e.target.value)
        // Apply as soon as a full 6-digit colour is typed, so the game updates while you type
        const hex = normalizeHex(e.target.value)
        if (hex && e.target.value.replace('#', '').length === 6) onChange(hex)
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      aria-label={`${label} — hex`}
    />
  )
}
