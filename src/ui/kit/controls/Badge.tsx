// BADGE — a small tag: "NEW", "3", "Host". variant: neutral | primary | danger.
import type { ReactNode } from 'react'

export function Badge({ variant = 'neutral', children }: { variant?: 'neutral' | 'primary' | 'danger'; children: ReactNode }) {
  return <span className="kit-badge" data-variant={variant}>{children}</span>
}
