// THE RECORDER — while ● Record is on, it fills the capture log: every event the game sends, and the game's
// state every few seconds. Cheap: one listener, one timer, and the log throws away anything older than ~60 s.
import type { DevKitGame } from '../devkitGame'
import { STATE_EVERY_MS, logEvent, logState, type CaptureLog } from './captureLog'

/** A plain-data copy of the game's state right now (so later play can't change what was logged). Never throws. */
export function copyOfState(game: DevKitGame): unknown {
  try {
    return JSON.parse(JSON.stringify(game.getState() ?? null))
  } catch (e) {
    return { error: `getState failed: ${(e as Error).message}` }
  }
}

/** Start recording into `log`. Returns the function that stops it. */
export function startRecording(game: DevKitGame, log: CaptureLog, clock: () => number = Date.now): () => void {
  logState(log, copyOfState(game), clock())
  const timer = setInterval(() => logState(log, copyOfState(game), clock()), STATE_EVERY_MS)
  let stopListening = () => {}
  try {
    stopListening = game.onEvent?.((text, data) => logEvent(log, String(text), data, clock())) ?? stopListening
  } catch (e) {
    logEvent(log, `Dev Kit: the game's onEvent failed — ${(e as Error).message}`, undefined, clock())
  }
  return () => {
    clearInterval(timer)
    stopListening()
  }
}
