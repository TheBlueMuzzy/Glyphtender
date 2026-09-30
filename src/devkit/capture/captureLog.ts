// THE BUG-CAPTURE LOG — a rolling window of the last ~60 seconds of play, kept cheaply while recording:
//   events: the short lines the game sends (onEvent) — "turn 12 · Blue moved"
//   states: the game's state every few seconds (getState), so Claude can see how it got there
//   marks:  every 📍 press — the moment, a note and the state right then. Marks are kept until Clear/Send,
//           even when older than the window (you marked it for a reason).
// Anything older than the window is dropped as new things come in, so memory stays flat however long you play.
// Plain functions and data, no React — the tab (CaptureTab.tsx) drives it, the tests check it.

export const KEEP_MS = 60_000 // how far back the log reaches
export const STATE_EVERY_MS = 5_000 // how often the recorder asks the game for its state
const MAX_EVENTS = 500 // a game that sends events every frame still can't fill memory
const MAX_MARKS = 20

export interface LoggedEvent { at: number; text: string; data?: unknown } // at = Date.now() when it happened
export interface LoggedState { at: number; state: unknown }
export interface Mark { at: number; summary: string; state: unknown }

export interface CaptureLog {
  keepMs: number
  events: LoggedEvent[]
  states: LoggedState[]
  marks: Mark[]
}

export function newCaptureLog(keepMs = KEEP_MS): CaptureLog {
  return { keepMs, events: [], states: [], marks: [] }
}

// Keep only what's inside the window (and at most `max` of the newest)
function trim<T extends { at: number }>(list: T[], oldest: number, max: number): T[] {
  const kept = list.filter((item) => item.at >= oldest)
  return kept.length > max ? kept.slice(kept.length - max) : kept
}

/** Add a game event. Changes the log in place (it's the recorder's own scratch space). */
export function logEvent(log: CaptureLog, text: string, data: unknown, now: number) {
  log.events.push(data === undefined ? { at: now, text } : { at: now, text, data })
  log.events = trim(log.events, now - log.keepMs, MAX_EVENTS)
}

/** Add a periodic state. */
export function logState(log: CaptureLog, state: unknown, now: number) {
  log.states.push({ at: now, state })
  log.states = trim(log.states, now - log.keepMs, Math.ceil(log.keepMs / STATE_EVERY_MS) + 1)
}

/** 📍 — "it happened here". */
export function logMark(log: CaptureLog, state: unknown, summary: string, now: number) {
  log.marks.push({ at: now, summary, state })
  if (log.marks.length > MAX_MARKS) log.marks.shift()
}

/** What the log holds right now, with anything past the window dropped (e.g. after a quiet minute). */
export function recentLog(log: CaptureLog, now: number): CaptureLog {
  const oldest = now - log.keepMs
  return {
    keepMs: log.keepMs,
    events: log.events.filter((e) => e.at >= oldest),
    states: log.states.filter((s) => s.at >= oldest),
    marks: [...log.marks],
  }
}

/** Empty it (after Send, or Clear). */
export function clearLog(log: CaptureLog) {
  log.events = []
  log.states = []
  log.marks = []
}
