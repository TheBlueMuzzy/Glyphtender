// PROGRESS BAR — how full something is (loading, health, XP). value: 0 to 1.
// variant: primary | accent | danger.
import type { CSSProperties } from 'react'

type ProgressBarProps = { value: number; label: string; variant?: 'primary' | 'accent' | 'danger' }

export function ProgressBar({ value, label, variant = 'primary' }: ProgressBarProps) {
  const fill = Math.min(1, Math.max(0, value))
  return (
    <div
      className="kit-progress" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}
      data-variant={variant} style={{ '--kit-fill': fill } as CSSProperties}
    >
      <span className="kit-progress-fill" />
    </div>
  )
}
