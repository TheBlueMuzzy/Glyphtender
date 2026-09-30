// SELECTOR — ◀ option ▶. The classic game settings control (difficulty, language, quality).
// Wraps around from the last option back to the first.
import { ArrowPicker } from './ArrowPicker'

type SelectorProps = { options: string[]; value: string; onChange: (value: string) => void; label: string }

export function Selector({ options, value, onChange, label }: SelectorProps) {
  const index = Math.max(0, options.indexOf(value))
  const step = (direction: -1 | 1) => onChange(options[(index + direction + options.length) % options.length])
  const many = options.length > 1
  return <ArrowPicker kind="selector" label={label} display={value} onStep={step} canPrev={many} canNext={many} prevIcon="◀" nextIcon="▶" />
}
