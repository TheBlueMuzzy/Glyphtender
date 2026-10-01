// Which Dev Kit sections are open (expanded) — remembered per game in this browser (localStorage), so the
// panel opens the way you left it. Any tab can use it (Section.tsx does). If the browser won't store anything
// (a private window), it still works until the page reloads.
import { useSyncExternalStore } from 'react'
import { getDevKitGame } from '../devkitGame'

type OpenMap = Record<string, boolean> // section id → open?

const listeners = new Set<() => void>()
let memory: OpenMap = {} // used when localStorage can't be read
let cache: { raw: string | null; open: OpenMap } = { raw: null, open: {} }

const storageKey = () => `devkit-sections:${getDevKitGame()?.name ?? document.title}`

function readAll(): OpenMap {
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw !== cache.raw) cache = { raw, open: raw ? (JSON.parse(raw) as OpenMap) : {} }
    return cache.open
  } catch {
    return memory
  }
}

/** Is this section open? `fallback` = before it was ever opened or closed. */
export function isSectionOpen(id: string, fallback: boolean): boolean {
  const open = readAll()
  return id in open ? open[id] === true : fallback
}

/** Open or close sections (and remember it). */
export function setSectionsOpen(ids: string[], open: boolean) {
  const next = { ...readAll() }
  for (const id of ids) next[id] = open
  memory = next
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next))
  } catch {
    // private window / storage full: kept in memory only
  }
  for (const listener of listeners) listener()
}

/** For a section's component: is it open? Re-renders when it opens or closes. */
export function useSectionOpen(id: string, fallback: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => isSectionOpen(id, fallback),
  )
}

/** Open a section and scroll the Dev Kit so its title is at the top (after React has drawn it open). */
export function goToSection(id: string) {
  setSectionsOpen([id], true)
  setTimeout(() => {
    const el = [...document.querySelectorAll<HTMLElement>('[data-dk-section]')].find((s) => s.dataset.dkSection === id)
    const scroller = el?.closest<HTMLElement>('.devkit-scroll')
    if (!el || !scroller) return
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo?.({ top: Math.max(0, top - 4), behavior: calm ? 'auto' : 'smooth' })
  }, 0)
}
