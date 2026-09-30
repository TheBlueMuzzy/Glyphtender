// A BUG CAPTURE — what Send makes from the log: everything /bug needs to write the report by itself
// (what went wrong, the moments you marked, the state then and now, the last ~60 s of events, version, device).
// In dev it's saved to the game's .planning/bugs/ (where /bug keeps captures); everywhere it can be copied for Claude.
import type { CaptureLog } from './captureLog'

export interface Device {
  userAgent: string
  screen: string // "390×844" (CSS pixels)
  window: string // the browser window, "390×664"
  pixelRatio: number
  orientation: 'portrait' | 'landscape'
  touch: boolean
}

export interface BugCapture {
  _help: string
  game: string
  version: string
  capturedAt: string // ISO date + time
  whatWentWrong: string
  device: Device
  /** Each 📍, oldest first — secondsAgo = how long before Send. */
  marks: { secondsAgo: number; summary: string; state: unknown }[]
  stateNow: { summary: string; state: unknown }
  /** The game's events in the last ~60 s, oldest first. */
  events: { secondsAgo: number; text: string; data?: unknown }[]
  /** The game's state every ~5 s over the same window, oldest first. */
  states: { secondsAgo: number; state: unknown }[]
}

const HELP = 'Dev Kit bug capture — for /bug. Marks = the moments the player pressed 📍 ("it happened here"), with the game state right then. secondsAgo = how long before Send.'

/** The device the game is running on, from the browser. */
export function readDevice(): Device {
  const width = window.innerWidth
  const height = window.innerHeight
  return {
    userAgent: navigator.userAgent,
    screen: `${screen.width}×${screen.height}`,
    window: `${width}×${height}`,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: width > height ? 'landscape' : 'portrait',
    touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
  }
}

const secondsAgo = (at: number, now: number) => Math.round((now - at) / 100) / 10 // 12.3

type BuildInput = {
  game: { name: string; version: string }
  whatWentWrong: string
  log: CaptureLog // already trimmed to the window (recentLog)
  stateNow: unknown
  summaryNow: string
  device: Device
  now: number
}

/** Put the capture together. */
export function buildBugCapture({ game, whatWentWrong, log, stateNow, summaryNow, device, now }: BuildInput): BugCapture {
  return {
    _help: HELP,
    game: game.name,
    version: game.version,
    capturedAt: new Date(now).toISOString(),
    whatWentWrong: whatWentWrong.trim() || '(no description — see the marks and events)',
    device,
    marks: log.marks.map((m) => ({ secondsAgo: secondsAgo(m.at, now), summary: m.summary, state: m.state })),
    stateNow: { summary: summaryNow, state: stateNow },
    events: log.events.map((e) => ({ secondsAgo: secondsAgo(e.at, now), text: e.text, ...(e.data === undefined ? {} : { data: e.data }) })),
    states: log.states.map((s) => ({ secondsAgo: secondsAgo(s.at, now), state: s.state })),
  }
}

/** "1 event", "3 events" */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const two = (n: number) => String(n).padStart(2, '0')

/** Where Send saves it in dev: ".planning/bugs/capture-2026-09-30-23-15-07.json" (local time). */
export function captureFilePath(date: Date): string {
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
  const time = `${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`
  return `.planning/bugs/capture-${day}-${time}.json`
}

/**
 * Copy for Claude: a line /bug recognises, where the file is (if saved), and the capture as JSON.
 * The every-5-seconds states are left out of the copy to keep it pasteable — the saved file has them.
 */
export function captureForClaude(capture: BugCapture, savedTo: string | null): string {
  const { states, ...rest } = capture
  const where = savedTo
    ? `Saved to ${savedTo} (with ${count(states.length, 'extra state snapshot')}, one every ~5 s).`
    : `Not saved as a file (live build) — please save it to .planning/bugs/ in the game.`
  return [
    `/bug — Dev Kit bug capture from ${capture.game} ${capture.version}: ${capture.whatWentWrong}`,
    where,
    '',
    JSON.stringify(rest, null, 2),
  ].join('\n')
}
