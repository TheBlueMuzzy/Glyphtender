// The overlay's plain helpers (kept out of PreviewOverlay.tsx so that file only exports its component).
import type { SandboxCounts } from './sandbox'

// The Back-button guard (the top of PreviewOverlay.tsx says why). Outside React on purpose: StrictMode runs effects twice in dev,
// and pushing/stepping history twice would close the preview the moment it opened.
let guardEntry = false
export function pushBackGuard() {
  if (guardEntry) return
  history.pushState(history.state, '')
  guardEntry = true
}
/** fromBack: the Back button already popped the entry. */
export function dropBackGuard(fromBack: boolean) {
  if (guardEntry && !fromBack) history.back()
  guardEntry = false
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
export function blockedLine(c: SandboxCounts): string {
  const parts = [c.saves && plural(c.saves, 'save'), c.sends && plural(c.sends, 'send'), c.sounds && plural(c.sounds, 'sound'), c.history && plural(c.history, 'history step')]
  const said = parts.filter(Boolean)
  return said.length ? `blocked: ${said.join(', ')}` : 'nothing blocked yet'
}
