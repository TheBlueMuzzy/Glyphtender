// BUTTON — variant: primary (main action) | secondary | ghost (quiet) | danger (destructive).
// icon: square icon-only button — always give it an aria-label.  loading: shows a spinner, can't be pressed.
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: boolean
  loading?: boolean
}

export function Button({ variant = 'primary', icon, loading, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`kit-button kit-target ${className}`}
      data-variant={variant}
      data-icon={icon || undefined}
      data-state={loading ? 'loading' : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="kit-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
