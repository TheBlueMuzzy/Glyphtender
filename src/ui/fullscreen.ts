// FULL SCREEN — so a phone on its side shows the whole game, not the browser's bars (Muzzy, 2026-10-03: "I send these
// links out to test with friends… I want them to experience the game as it is meant to be experienced").
// A browser only goes full screen from a tap or a click, never by itself as the page opens. So:
//   phones & tablets (touch): with Settings → Display → Full screen on (the default there), the first tap goes full
//     screen — and so does the next tap after leaving it (the phone's back gesture). Turn it off to stay in the browser.
//   computers: never on their own — the main menu's Full screen button or the Settings toggle (Esc leaves, which
//     turns the setting off).
//   iPhone: Safari can't make a page full screen; "Add to Home Screen" opens it like an app, with no browser bars.
//     Settings shows that tip instead of the toggle.
//   installed (opened from the home screen): already without browser bars — the button and the row are hidden.
import { create } from 'zustand'
import { settingsStorageKey, type SettingsSchema, type SettingsValues } from './kit'

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> }
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
const doc = () => document as FsDocument

const fullscreenNow = () => typeof document !== 'undefined' && Boolean(doc().fullscreenElement || doc().webkitFullscreenElement)

/** This browser can make the page full screen (false on iPhone Safari). */
export const canFullscreen = () => typeof document !== 'undefined' && Boolean(doc().fullscreenEnabled || doc().webkitFullscreenEnabled)

/** Opened from the home screen (installed): there are no browser bars to hide. (A page made full screen ALSO matches
 *  display-mode: fullscreen in Chrome, so that one only counts when the page itself isn't full screen.) */
export const isInstalled = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(display-mode: standalone)').matches
  || (window.matchMedia?.('(display-mode: fullscreen)').matches && !fullscreenNow())
  || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** A phone or tablet: touch, no mouse. */
export const isTouchDevice = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
  && !window.matchMedia?.('(any-pointer: fine)').matches

export function enterFullscreen() {
  if (fullscreenNow() || !canFullscreen()) return
  const root = document.documentElement as FsElement
  const go = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.()
  go?.catch(() => { /* the browser said no (not from a tap): the next tap tries again */ })
}

export function exitFullscreen() {
  if (!fullscreenNow()) return
  const go = document.exitFullscreen ? document.exitFullscreen() : doc().webkitExitFullscreen?.()
  go?.catch(() => {})
}

/** Is the page full screen right now (the main menu button's words follow it). */
export const useFullscreen = create<{ on: boolean }>()(() => ({ on: fullscreenNow() }))

/** The settings list with the Full screen row's default for this device: on for phones & tablets, off for computers. */
export function withFullscreenDefault(schema: SettingsSchema): SettingsSchema {
  const touch = isTouchDevice()
  return { ...schema, tabs: schema.tabs.map((tab) => ({ ...tab, rows: tab.rows.map((row) => (row.id === 'fullscreen' ? { ...row, default: touch } : row)) })) }
}

/** Settings rows to hide on this device: the toggle where it can't work, the iPhone tip where it isn't needed. */
export function hiddenFullscreenRows(): string[] {
  if (isInstalled()) return ['fullscreen', 'fullscreenTip']
  return canFullscreen() ? ['fullscreenTip'] : ['fullscreen']
}

let wanted = false // Settings → Full screen
let current: () => SettingsValues = () => ({}) // the saved settings, as they are now (startFullscreen)

function save(on: boolean) {
  const next = { ...current(), fullscreen: on }
  try { localStorage.setItem(settingsStorageKey(), JSON.stringify(next)) } catch { /* not remembered, still works */ }
  return next
}

/** Settings changed (or loaded): Full screen on → go now (this is a tap), off → leave. */
export function fullscreenSetting(values: SettingsValues, changed?: string) {
  wanted = values.fullscreen === true
  if (changed !== 'fullscreen') return
  if (wanted) enterFullscreen()
  else exitFullscreen()
}

/** The main menu button: the same as flipping the Settings toggle (saved, so Settings shows it too). */
export function setFullscreen(on: boolean) {
  fullscreenSetting(save(on), 'fullscreen')
}

/** Once, at start-up: follow the page going in and out of full screen, and on phones go full screen on a tap.
 *  load = the saved settings as they are now. */
export function startFullscreen(load: () => SettingsValues) {
  current = load
  wanted = load().fullscreen === true
  const changed = () => {
    useFullscreen.setState({ on: fullscreenNow() })
    // A computer's Esc leaves full screen: the setting follows, so Settings never says "on" in a window
    if (!fullscreenNow() && wanted && !isTouchDevice()) {
      wanted = false
      save(false)
    }
  }
  document.addEventListener('fullscreenchange', changed)
  document.addEventListener('webkitfullscreenchange', changed)
  if (!isTouchDevice() || isInstalled() || !canFullscreen()) return
  // (pointerup: a tap counts as permission to go full screen — capture, so it runs before the game handles the tap)
  window.addEventListener('pointerup', () => { if (wanted) enterFullscreen() }, { capture: true })
}
