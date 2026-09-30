// SLIDER — pick a number by dragging (volume, sensitivity). Uses the browser's own range input,
// so arrow keys, screen readers and touch all work for free.
import type { CSSProperties } from 'react'

type SliderProps = {
  value: number; onChange: (value: number) => void; label: string
  min?: number; max?: number; step?: number; disabled?: boolean
}

export function Slider({ value, onChange, label, min = 0, max = 100, step = 1, disabled }: SliderProps) {
  const fill = (value - min) / (max - min) // 0..1, paints the filled part of the track
  return (
    <input
      type="range"
      className="kit-slider kit-target"
      aria-label={label}
      min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--kit-fill': fill } as CSSProperties}
    />
  )
}
