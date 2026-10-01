// THE BMUZ DEV KIT — developer tools that live inside the game. From the Game Framework (devkit/):
// copied into the game's src/devkit/ by install-devkit — don't edit it here, change it in the framework.
// main.tsx loads it (via mount.tsx) with a dynamic import: always in dev; in release builds only while
// content/devkit.json "inReleaseBuilds" is true (through beta). When it's false, the live build has none of it.
// Release builds can't Save (no dev server) — tools offer Copy for Claude instead (CAN_SAVE in saveContent.ts).
//   Open:  the ` key (desktop) or triple-tap the top-right corner (phone)
//   Close: Esc, the ✕ button, or ` again
// Tools are tabs on their own full-width row under the title: the kit's own (KIT_TABS), then the game's own from src/devkit-game/tabs.ts.
// More than fit → ◀ ▶ and page dots (carousel/Carousel.tsx), never a sideways scroll bar.
// Under the tabs: a search box (search/SearchBar.tsx). Typing filters every SETTINGS tab at once (a tab with
// countMatches — Color, Tuning): their matching settings, grouped by tab and section, highlighted. Tapping a section
// title in the results clears the search and takes you there. Esc clears the search first, then closes.
// The one rule (DEVKIT.md): tools edit content/ JSON files, never code.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { gameTabs } from '../devkit-game/tabs'
import { CaptureTab } from './capture/CaptureTab'
import { Carousel } from './carousel/Carousel'
import { ColorTab } from './color/ColorTab'
import { searchUiColours } from './color/colorLogic'
import { styleFile, uiKit } from './color/uiKit'
import { CAN_SAVE } from './saveContent'
import { SearchBar } from './search/SearchBar'
import { DevKitSearch } from './search/searchContext'
import { countFound, searchTerms } from './search/searchLogic'
import { goToSection } from './search/sectionState'
import { SnapshotsTab } from './snapshots/SnapshotsTab'
import { TuningTab } from './tuning/TuningTab'
import { sectionOrder, tuningFiles } from './tuning/tuningFiles'
import { searchTuning, tuningSections } from './tuning/tuningSections'
import './devkit.css'
import './search/search.css'

// Searched for by the release check (check-devkit.mjs) — it must never appear in a build with the Dev Kit off
const DEVKIT_MARKER = 'bmuz-devkit-console'

/**
 * One tool = one tab. A game adds its own in src/devkit-game/tabs.ts.
 * countMatches: a tab that lists settings can join the search — return how many match the text (0 hides the tab
 * from the results) and filter itself by the search text it reads with useContext(DevKitSearch)
 * (search/searchContext.ts; search/searchLogic.ts + search/Section.tsx do the work).
 */
export type DevKitTab = { id: string; label: string; Panel: ComponentType; countMatches?: (query: string) => number }

const tuningIndex = tuningSections(tuningFiles, sectionOrder) // for counting matches (the tab builds its own copy)

// Loaded on first use, and only in dev: in a release build import.meta.env.DEV is false, so this import is dropped
const ScreensTab = import.meta.env.DEV ? lazy(() => import('./previews/PreviewsTab')) : null
function ScreensPanel() {
  return ScreensTab && <Suspense fallback={<p className="devkit-not-plugged">Loading…</p>}><ScreensTab /></Suspense>
}

// While a screen preview is open it owns the keys (Esc closes it) and the whole window, so the panel stands aside
const previewOpen = () => document.querySelector('dialog.devkit-preview[open]') !== null

const KIT_TABS: DevKitTab[] = [
  { id: 'color', label: 'Color', Panel: ColorTab, countMatches: (q) => (uiKit && styleFile ? countFound(searchUiColours(q)) : 0) },
  // Only when the game has content/tuning/*.json files
  ...(tuningFiles.length > 0
    ? [{ id: 'tuning', label: 'Tuning', Panel: TuningTab, countMatches: (q: string) => countFound(searchTuning(tuningIndex, q)) }]
    : []),
  // These two need the game's adapter (registerDevKitGame, devkitGame.ts); without it they say how to add it
  { id: 'snapshots', label: 'Snapshots', Panel: SnapshotsTab },
  { id: 'bugs', label: 'Bugs', Panel: CaptureTab },
  // Screen previews: DEV ONLY — never in a release build, even while inReleaseBuilds is true (previews/PreviewsTab.tsx)
  ...(ScreensTab ? [{ id: 'screens', label: 'Screens', Panel: ScreensPanel }] : []),
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
  const [query, setQuery] = useState('')
  const openRef = useRef(open) // the key handler below reads these (it's set up once)
  const queryRef = useRef(query)
  const panel = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    queryRef.current = query
  }, [query])
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
      if (previewOpen()) return
      if ((e.key === '`' || e.code === 'Backquote') && !isTyping(e.target)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && openRef.current) {
        e.stopPropagation() // the Dev Kit eats this Esc so the game doesn't also react to it
        if (queryRef.current) setQuery('') // first Esc clears the search, the next one closes
        else setOpen(false)
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
      if (!inCorner || onPanel || previewOpen()) return
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

  // Search: which tabs join it, and how many of each one's settings match
  const searching = searchTerms(query).length > 0
  const searchable = tabs.some((t) => t.countMatches)
  const counts = Object.fromEntries(tabs.map((t) => [t.id, searching && t.countMatches ? t.countMatches(query) : 0]))
  const found = Object.values(counts).reduce((a, b) => a + b, 0)

  // Each tab keeps its own scroll position (they share one scrolling area)
  const scrollTops = useRef<Record<string, number>>({})
  const view = searching ? '?search' : tabId
  const shownView = useRef(view)
  useLayoutEffect(() => {
    const box = scroller.current
    if (!box || shownView.current === view) return
    box.scrollTop = scrollTops.current[view] ?? 0
    shownView.current = view
  }, [view])
  const remember = () => {
    if (scroller.current) scrollTops.current[shownView.current] = scroller.current.scrollTop
  }
  const pickTab = (id: string) => {
    remember()
    setQuery('')
    setTabId(id)
  }
  const search = (text: string) => {
    if (!searching) remember()
    setQuery(text)
  }
  // A section title tapped in the results: back to that tab, with the section open and scrolled to
  const goTo = (id: string) => (sectionId: string) => {
    pickTab(id)
    goToSection(sectionId)
  }

  // The panel stays mounted while hidden, so unsaved edits survive closing and reopening it.
  return (
    <aside ref={panel} {...{ popover: 'manual' }} className="devkit" data-devkit={DEVKIT_MARKER} hidden={!open} aria-label="Dev Kit">
      {/* Two rows: a small title + ✕, then the tool tabs across the panel's FULL width (more tabs per page) */}
      <header className="devkit-top">
        <div className="devkit-title-row">
          <strong className="devkit-title">Dev Kit</strong>
          <button className="devkit-close" onClick={closeFromButton} aria-label="Close the Dev Kit" title="Close (Esc)">
            ✕
          </button>
        </div>
        {/* More tools than fit (a phone): a dot carousel, never a sideways scroll bar */}
        <Carousel className="devkit-tabs" label="Tools" role="tablist" active={tabs.findIndex((t) => t.id === tabId)}>
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={!searching && t.id === tabId}
              className="devkit-tab"
              onClick={() => pickTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </Carousel>
        {searchable && <SearchBar value={query} onChange={search} found={searching ? found : null} />}
      </header>
      {!CAN_SAVE && (
        <p className="devkit-live-note">Live build: changes last until you refresh — copy them for Claude to keep.</p>
      )}
      {/* One scrolling area for every tab, so search results from several tabs scroll together */}
      <div ref={scroller} className="devkit-scroll">
        {searching && found === 0 && (
          <p className="dk-results-none">Nothing matches “{query.trim()}”. Try part of a word — fade, trail, pop.</p>
        )}
        {tabs.map((t) => (
          <section
            key={t.id}
            className="devkit-body"
            hidden={searching ? !counts[t.id] : t.id !== tabId}
            role="tabpanel"
            aria-label={t.label}
          >
            {searching && <h2 className="dk-results-tab">{t.label} · {counts[t.id]}</h2>}
            <DevKitSearch.Provider value={{ query: t.countMatches ? query : '', goTo: goTo(t.id) }}>
              <t.Panel />
            </DevKitSearch.Provider>
          </section>
        ))}
      </div>
    </aside>
  )
}
