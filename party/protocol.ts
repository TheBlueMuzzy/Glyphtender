// GLYPHTENDER ONLINE — the game's own messages, shared by the server (party/) and the game (src/).
// The rooms module (src/rooms/protocol.ts) carries these inside its `action` and `view` messages:
//   player → server: an OnlineAction      server → player: a GameView (only what that player may see)
// No React, no browser code here — the server imports it.
import type { Action, GameState } from '../src/engine/types'
import type { PlayerStats } from '../src/store/stats'

/** The host's new-game options (the same as the new-game screen, minus "hide seeds" — each player has their own device). */
export interface OnlineOptions {
  /** A board from content/data/boards.json, or 'auto' = the default board for however many players sit down. */
  boardName: string
  /** 2 = two-letter words count; 3 = the "2-letter words off" table option. */
  minWordLength: number
  /** Seconds per turn, 0 = no timer (content/rooms.json → turnTimerChoices). */
  turnSeconds: number
}

/** What a player sends: a move planned on `version` of the game, or "send me my view again". */
export type OnlineAction =
  | { kind: 'play'; action: Action; version: number }
  | { kind: 'sync' }

/** What changed the game last: the start, or one seat's draft placement / turn / refresh. */
export type Change = 'start' | 'draft' | 'turn' | 'refresh'

/** At game over: the whole truth for the Magic reveal and the end table. */
export interface Results {
  stats: PlayerStats[]
}

/** One player's view of the game. Shaped like the real game, with everything secret taken OUT of the data. */
export interface GameView {
  /** A new number for every game in the room (a rematch starts a new one). */
  gameId: number
  /** How many changes have been made to this game. A view with an older version is stale. */
  version: number
  /** Your seat (0 = Yellow, 1 = Blue…); -1 = you're not playing in this game. */
  mySeat: number
  /** Player names in seat order. */
  names: string[]
  /** What made this version, and which seat did it (null for the start). */
  change: Change
  by: number | null
  /** The game: your own hand; other hands and the bag as '?' × count; rng, seed and Magic zeroed — until game over. */
  game: GameState
  /** When the current turn's timer runs out (server time, ms), or null when there's no timer. */
  turnEndsAt: number | null
  /** Only once the game is over. */
  results: Results | null
}

/** What stands in for a seed nobody may see (another player's hand, the bag). */
export const HIDDEN = '?'
