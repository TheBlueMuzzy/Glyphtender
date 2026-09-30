// TABS — a row of tab buttons (Settings: Audio / Display / Controls…).
// Only draws the tab bar; show the matching content yourself based on `value`.
// ← / → move between tabs, like every console game.
import type { KeyboardEvent } from 'react'

type TabsProps = { tabs: string[]; value: string; onChange: (tab: string) => void; label: string }

export function Tabs({ tabs, value, onChange, label }: TabsProps) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!direction) return
    e.preventDefault()
    const next = (tabs.indexOf(value) + direction + tabs.length) % tabs.length
    onChange(tabs[next])
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }
  return (
    <div className="kit-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab} type="button" role="tab" className="kit-tab kit-target"
          aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
          data-state={tab === value ? 'active' : undefined}
          onClick={() => onChange(tab)}
        >{tab}</button>
      ))}
    </div>
  )
}
