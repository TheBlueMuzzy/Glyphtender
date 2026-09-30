// LAYOUT BOXES — Screen, Panel, Stack, Row, Grid.
// They only arrange things. Spacing is always a gap name (xs, s, m, l, xl) — never a size.
import type { HTMLAttributes, ReactNode } from 'react'

export type Gap = 'xs' | 's' | 'm' | 'l' | 'xl'
type BoxProps = HTMLAttributes<HTMLDivElement> & { gap?: Gap }

// A full-area layer with safe slots (clear of phone notches). HUDs and menus start here.
// Empty space lets taps through to the game underneath; only the slot contents catch taps.
type ScreenProps = {
  topLeft?: ReactNode; top?: ReactNode; topRight?: ReactNode
  bottomLeft?: ReactNode; bottom?: ReactNode; bottomRight?: ReactNode
  children?: ReactNode // goes in the centre
  label?: string // what a screen reader calls this screen
  dialog?: boolean // dims what's underneath; for a small question on top of another screen
}
export function Screen({ children, label, dialog, ...slots }: ScreenProps) {
  const slotNames = { topLeft: 'top-left', top: 'top', topRight: 'top-right', bottomLeft: 'bottom-left', bottom: 'bottom', bottomRight: 'bottom-right' }
  return (
    <section className="kit-screen" aria-label={label} data-dialog={dialog || undefined}
      role={dialog ? 'dialog' : undefined} aria-modal={dialog || undefined}>
      {Object.entries(slotNames).map(([prop, slot]) => {
        const content = slots[prop as keyof typeof slots]
        return content ? <div key={slot} data-slot={slot}>{content}</div> : null
      })}
      {children && <div data-slot="center">{children}</div>}
    </section>
  )
}

// A raised surface that groups things (menu box, settings card, dialog body).
export function Panel({ gap = 'm', depth = 1, className = '', ...rest }: BoxProps & { depth?: 0 | 1 | 2 }) {
  return <div className={`kit-panel ${className}`} data-gap={gap} data-depth={depth} {...rest} />
}

// Things top to bottom.
export function Stack({ gap = 'm', className = '', ...rest }: BoxProps) {
  return <div className={`kit-stack ${className}`} data-gap={gap} {...rest} />
}

// Things side by side; wraps onto a new line when there's no room.
// justify: "start" | "center" | "end" | "between" (push to both ends)
export function Row({ gap = 'm', justify = 'start', className = '', ...rest }: BoxProps & { justify?: 'start' | 'center' | 'end' | 'between' }) {
  return <div className={`kit-row ${className}`} data-gap={gap} data-justify={justify} {...rest} />
}

// Equal tiles that fit as many per line as there's room for. min = smallest tile: s, m or l.
export function Grid({ gap = 'm', min = 'm', className = '', ...rest }: BoxProps & { min?: 's' | 'm' | 'l' }) {
  return <div className={`kit-grid ${className}`} data-gap={gap} data-min={min} {...rest} />
}
