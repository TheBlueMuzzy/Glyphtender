// STEPPER — − number +. Stops at min and max (player count, rounds).
import { ArrowPicker } from './ArrowPicker'

type StepperProps = { value: number; onChange: (value: number) => void; label: string; min?: number; max?: number; step?: number }

export function Stepper({ value, onChange, label, min = 0, max = 99, step = 1 }: StepperProps) {
  return (
    <ArrowPicker
      kind="stepper" label={label} display={value}
      onStep={(direction) => onChange(Math.min(max, Math.max(min, value + direction * step)))}
      canPrev={value > min} canNext={value < max} prevIcon="−" nextIcon="+"
    />
  )
}
