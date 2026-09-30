// SCROLL AREA — a box that scrolls when its contents are too tall.
// max: how tall before it scrolls — s, m or l. Without max it fills its parent.
import type { ReactNode } from 'react'

export function ScrollArea({ label, max, children }: { label: string; max?: 's' | 'm' | 'l'; children: ReactNode }) {
  // tabIndex lets keyboard players focus it and scroll with the arrow keys
  return <div className="kit-scroll" role="region" aria-label={label} tabIndex={0} data-max={max}>{children}</div>
}
