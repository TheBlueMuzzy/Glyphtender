// BUTTON — variant: primary (main action) | secondary | ghost (quiet) | danger (destructive).
// icon: square icon-only button — always give it an aria-label.  loading: shows a spinner, can't be pressed.
// size: how tall (and at least how wide) it is, in px — for a game whose buttons should match its pieces
//   (e.g. as big as a board hex). Never smaller than the style's target-min (44px).
// compact: less room each side of the label — a row of 3 big buttons that must fit a narrow phone on ONE line.
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: boolean
  loading?: boolean
  size?: number
  compact?: boolean
}

export function Button({ variant = 'primary', icon, loading, size, compact, disabled, className = '', style, children, ...rest }: ButtonProps) {
  const px = size && size > 0 ? Math.round(size) : 0 // 0 = the normal size
  return (
    <button
      type="button"
      className={`kit-button kit-target ${className}`}
      data-variant={variant}
      data-icon={icon || undefined}
      data-sized={px > 0 || undefined}
      data-compact={compact || undefined}
      data-state={loading ? 'loading' : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      style={{ ...style, '--kit-button-size': px > 0 ? `${px}px` : undefined } as CSSProperties}
      {...rest}
    >
      {loading && <span className="kit-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
