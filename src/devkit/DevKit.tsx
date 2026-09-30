// THE BMUZ DEV KIT — developer tools that live inside the game. From the Game Framework (devkit/):
// copied into the game's src/devkit/ by install-devkit — don't edit it here, change it in the framework.
// main.tsx loads it (via mount.tsx) with a dynamic import: always in dev; in release builds only while
// content/devkit.json "inReleaseBuilds" is true (through beta). When it's false, the live build has none of it.
// Release builds can't Save (no dev server) — tools offer Copy for Claude instead (CAN_SAVE in saveContent.ts).
//   Open:  the ` key (desktop) or triple-tap the top-right corner (phone)
//   Close: Esc, the ✕ button, or ` again
// Tools are tabs across the top: the kit's own (KIT_TABS), then the game's own from src/devkit-game/tabs.ts.
// The one rule (DEVKIT.md): tools edit content/ JSON files, never code.
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { gameTabs } from '../devkit-game/tabs'
import { CaptureTab } from './capture/CaptureTab'
import { ColorTab } from './color/ColorTab'
import { CAN_SAVE } from './saveContent'
import { SnapshotsTab } from './snapshots/SnapshotsTab'
import { TuningTab } from './tuning/TuningTab'
import { tuningFiles } from './tuning/tuningFiles'
import './devkit.css'

// Searched for by the release check (check-devkit.mjs) — it must never appear in a build with the Dev Kit off
const DEVKIT_MARKER = 'bmuz-devkit-console'

/** One tool = one tab. A game adds its own in src/devkit-game/tabs.ts. */
export type DevKitTab = { id: string; label: string; Panel: ComponentType }

const KIT_TABS: DevKitTab[] = [
  { id: 'color', label: 'Color', Panel: ColorTab },
  // Only when the game has content/tuning/*.json files
  ...(tuningFiles.length > 0 ? [{ id: 'tuning', label: 'Tuning', Panel: TuningTab }] : []),
  // These two need the game's adapter (registerDevKitGame, devkitGame.ts); without it they say how to add it
  { id: 'snapshots', label: 'Snapshots', Panel: SnapshotsTab },
  { id: 'bugs', label: 'Bugs', Panel: CaptureTab },
]

const CORNER_SIZE_PX = 64 // the invisible top-right square you triple-tap on a phone
const TRIPLE_TAP_MS = 700 // all three taps must land within this time
const GHOST_CLICK_MS = 500 // see closeFromButton

// Is the player typing in one of the game's text boxes? Then ` is just a character, not the Dev Kit key.
// (The Dev Kit's own boxes never need a `, so there it still opens/closes the panel.)
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el || el.closest?.('.devkit')) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function DevKit({ tabs = [...KIT_TABS, ...gameTabs] }: { tabs?: DevKitTab[] }) {
  const [open, setOpen] = useState(false)
  const [tabId, setTabId] = useState(tabs[0]?.id)
  const openRef = useRef(open) // the key handler below reads this (it's set up once)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    openRef.current = open
    // The game's toasts and tooltips are browser popovers, which float above any z-index.
    // Making the panel a popover too puts it on top of whatever is showing when it opens.
    const el = panel.current
    if (!el?.showPopover) return // older browsers: `hidden` alone shows/hides it
    if (open && !el.matches(':popover-open')) el.showPopover()
    if (!open && el.matches(':popover-open')) el.hidePopover()
  }, [open])

  // ` toggles, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '`' || e.code === 'Backquote') && !isTyping(e.target)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && openRef.current) {
        e.stopPropagation() // the Dev Kit eats this Esc so the game doesn't also react to it
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Triple-tap the top-right corner (phones have no ` key)
  const lastTripleTap = useRef(-Infinity)
  useEffect(() => {
    let taps: number[] = []
    const onDown = (e: PointerEvent) => {
      const inCorner = e.clientX > window.innerWidth - CORNER_SIZE_PX && e.clientY < CORNER_SIZE_PX
      const onPanel = (e.target as HTMLElement | null)?.closest?.('.devkit')
      if (!inCorner || onPanel) return
      const now = performance.now()
      taps = taps.filter((t) => now - t < TRIPLE_TAP_MS)
      taps.push(now)
      if (taps.length >= 3) {
        taps = []
        lastTripleTap.current = now
        setOpen((o) => !o)
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  // The third tap's "click" arrives after the panel has opened — right on top of ✕. Ignore that one.
  const closeFromButton = () => {
    if (performance.now() - lastTripleTap.current > GHOST_CLICK_MS) setOpen(false)
  }

  // The panel stays mounted while hidden, so unsaved edits survive closing and reopening it.
  return (
    <aside ref={panel} {...{ popover: 'manual' }} className="devkit" data-devkit={DEVKIT_MARKER} hidden={!open} aria-label="Dev Kit">
      <header className="devkit-top">
        <strong className="devkit-title">Dev Kit</strong>
        <nav className="devkit-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tabId}
              className="devkit-tab"
              onClick={() => setTabId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="devkit-close" onClick={closeFromButton} aria-label="Close the Dev Kit" title="Close (Esc)">
          ✕
        </button>
      </header>
      {!CAN_SAVE && (
        <p className="devkit-live-note">Live build: changes last until you refresh — copy them for Claude to keep.</p>
      )}
      {tabs.map((t) => (
        <section key={t.id} className="devkit-body" hidden={t.id !== tabId} role="tabpanel" aria-label={t.label}>
          <t.Panel />
        </section>
      ))}
    </aside>
  )
}
