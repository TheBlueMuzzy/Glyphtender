// CARD — a tile with a title (mode select, level, reward). With onClick it can be picked;
// `selected` marks the chosen one.
import type { ReactNode } from 'react'

type CardProps = { title: ReactNode; children?: ReactNode; selected?: boolean; onClick?: () => void }

export function Card({ title, children, selected, onClick }: CardProps) {
  const inside = <><span className="kit-card-title">{title}</span>{children}</>
  const state = selected ? 'selected' : undefined
  return onClick
    ? <button type="button" className="kit-card kit-target" data-depth={1} data-state={state} aria-pressed={selected} onClick={onClick}>{inside}</button>
    : <article className="kit-card" data-depth={1} data-state={state}>{inside}</article>
}
