// THE GAME AS THE SERVER KEEPS IT — the whole truth (every hand, the bag, the rng, all Magic) plus the
// room's bookkeeping. It is never sent to anyone as is: views.ts cuts one player's view out of it.
import { applyAction } from '../src/engine/engine'
import type { Action, GameState, WordList } from '../src/engine/types'
import { addTurn, type PlayerStats } from '../src/store/stats'
import type { Change, OnlineOptions } from './protocol'

/** The whole game as the server keeps it (never sent to anyone as is). */
export interface ServerGame {
  game: GameState
  gameId: number
  version: number
  /** Room seat ids in seat order (seat 0 = Yellow…). */
  seatIds: string[]
  names: string[]
  options: OnlineOptions
  change: Change
  by: number | null
  /** The end table's numbers, gathered on the server turn by turn (D21). */
  stats: PlayerStats[]
  turnEndsAt: number | null
  /** The random position for turns the server plays itself (timer ran out, a bot has the seat). */
  botRng: number
}

/** Plays one engine action for `seat` and keeps the end-table numbers (throws if the engine says no). */
export function play(state: ServerGame, seat: number, action: Action, words: WordList): ServerGame {
  const game = applyAction(state.game, action, words)
  const stats = action.type === 'turn' && game.lastTurn ? addTurn(state.stats, game.lastTurn) : state.stats
  return { ...state, game, stats, version: state.version + 1, change: action.type, by: seat }
}
