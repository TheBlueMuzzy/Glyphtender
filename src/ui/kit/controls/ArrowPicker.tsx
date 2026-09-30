// The shared "◀ value ▶" shape behind Selector and Stepper.
// It is ONE focus stop: ← / → (keyboard, or a gamepad d-pad sent as arrow keys) step the value.
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from './Button'

type ArrowPickerProps = {
  label: string; display: ReactNode; onStep: (direction: -1 | 1) => void
  canPrev: boolean; canNext: boolean; prevIcon: string; nextIcon: string; kind: string
}

export function ArrowPicker({ label, display, onStep, canPrev, canNext, prevIcon, nextIcon, kind }: ArrowPickerProps) {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && canPrev) onStep(-1)
    else if (e.key === 'ArrowRight' && canNext) onStep(1)
    else return
    e.preventDefault()
  }
  return (
    <div className={`kit-picker kit-${kind}`} role="group" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>
      <Button variant="ghost" icon tabIndex={-1} aria-label={`Previous ${label}`} disabled={!canPrev} onClick={() => onStep(-1)}>{prevIcon}</Button>
      <output className="kit-picker-value" aria-live="polite">{display}</output>
      <Button variant="ghost" icon tabIndex={-1} aria-label={`Next ${label}`} disabled={!canNext} onClick={() => onStep(1)}>{nextIcon}</Button>
    </div>
  )
}
