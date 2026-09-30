// THE HOST'S TABLE OPTIONS for an online game — the same choices as the new-game screen (garden, 2-letter
// words) plus the turn timer; "hide seeds" isn't needed (everyone has their own device). The host's last
// choices are remembered on their device (never required: if the browser won't store them, the defaults are used).
import roomsJson from '../../../content/rooms.json'
import rulesJson from '../../../content/tuning/rules.json'
import type { OnlineOptions } from '../../../party/protocol'
import { boardNames } from '../../engine/boards'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
const SAVE_KEY = 'glyphtender:online-options'

/** First time: the board picked by how many sit down, 2-letter words as rules.json says, the first timer choice (off), word indicators on. */
export const defaultOnlineOptions = (): OnlineOptions =>
  ({ boardName: 'auto', minWordLength: rulesJson.minWordLength, turnSeconds: roomsJson.turnTimerChoices[0], wordIndicators: true })

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The host's last options, or the defaults (anything missing or odd falls back too). */
export function loadOnlineOptions(storage: Storage | null = browserStorage()): OnlineOptions {
  const fallback = defaultOnlineOptions()
  try {
    const saved = JSON.parse(storage?.getItem(SAVE_KEY) ?? 'null') as Partial<OnlineOptions> | null
    if (!saved) return fallback
    return {
      boardName: ['auto', ...boardNames()].includes(String(saved.boardName)) ? String(saved.boardName) : fallback.boardName,
      minWordLength: saved.minWordLength === 2 || saved.minWordLength === 3 ? saved.minWordLength : fallback.minWordLength,
      turnSeconds: roomsJson.turnTimerChoices.includes(Number(saved.turnSeconds)) ? Number(saved.turnSeconds) : fallback.turnSeconds,
      wordIndicators: typeof saved.wordIndicators === 'boolean' ? saved.wordIndicators : fallback.wordIndicators,
    }
  } catch {
    return fallback
  }
}

export function saveOnlineOptions(options: OnlineOptions, storage: Storage | null = browserStorage()) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(options))
  } catch {
    // Storage full or refused: the game still starts, it just won't remember
  }
}
