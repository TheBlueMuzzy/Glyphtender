// HOW A GAME PLUGS INTO THE DEV KIT — for the tools that need the game itself (Snapshots, Bug capture).
// The Dev Kit never imports game code. Instead the game hands it a small adapter, once, from
// src/devkit-game/tabs.ts (that file only loads with the Dev Kit, so the adapter never ships at 1.0):
//
//   import { registerDevKitGame } from '../devkit/devkitGame'
//   registerDevKitGame({
//     name: 'Glyphtender',
//     version: '0.1.0.12',
//     getState: () => ({ ... }),              // this exact moment, as plain JSON data
//     setState: (state) => { ... },           // put the game back to a getState() moment
//     canRestore: () => !isOnlineGame,        // false in online games: restoring would change play for others
//     onEvent: (send) => store.subscribe(...) // optional: call send('Blue moved', {...}) as things happen;
//   })                                        //   return the function that stops listening
import { useSyncExternalStore } from 'react'

/** The game's side of the Dev Kit. Keep getState's result JSON-safe: no functions, Maps, Sets or classes. */
export interface DevKitGame {
  /** Shown in snapshots and bug captures, e.g. "Glyphtender". */
  name: string
  /** The game's version, e.g. "0.1.0.12" — stamped on every snapshot and bug capture. */
  version: string
  /** This exact moment of the game, as plain JSON data. */
  getState: () => unknown
  /** Put the game back to a moment getState() gave (maybe from an older build — check it if that can break). */
  setState: (state: unknown) => void
  /** May the Dev Kit restore right now? Must be false in online games (DEVKIT.md: tools that affect play are offline-only). */
  canRestore: () => boolean
  /** Optional: game events for the bug-capture log. Call `send` with a short line as things happen; return "stop listening". */
  onEvent?: (send: (text: string, data?: unknown) => void) => () => void
  /** Optional: one line about a moment, e.g. "turn 12 · Blue to move" — shown next to snapshots and marks. */
  describe?: (state: unknown) => string
}

let current: DevKitGame | null = null
const listeners = new Set<() => void>()

/** The game calls this once (from src/devkit-game/tabs.ts). Calling it again replaces the adapter; null unplugs it. */
export function registerDevKitGame(game: DevKitGame | null) {
  current = game
  for (const listener of listeners) listener()
}

/** The registered game, or null if the game hasn't plugged in. */
export function getDevKitGame(): DevKitGame | null {
  return current
}

/** For Dev Kit tabs: the registered game, re-rendering if it registers (or changes) later. */
export function useDevKitGame(): DevKitGame | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getDevKitGame,
  )
}

/** One line about a moment: the game's own describe(), or nothing. Never throws. */
export function describeMoment(game: DevKitGame, state: unknown): string {
  try {
    return game.describe?.(state) ?? ''
  } catch {
    return ''
  }
}
