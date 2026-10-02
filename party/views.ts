// WHAT EACH PLAYER MAY SEE (design/online.md §2). The server keeps the whole game; every player is sent
// a copy with the secrets taken OUT of the data (TDD D06) — a modified browser can't show what it never got.
// Until the game is over: other players' seeds and the bag become '?' (you may know how many, never which),
// and the rng, the random seed and every Magic number are zeroed, and the game log (every turn's words, Magic and
// running totals — src/engine/log.ts) is sent EMPTY. At game over everyone gets the whole truth, log and all.
import { emptyLog } from '../src/engine/log'
import type { GameState } from '../src/engine/types'
import { HIDDEN, type GameView, type Results } from './protocol'
import type { ServerGame } from './serverGame'

/** The game as `seat` may see it (seat -1 = someone not playing: sees no hand at all). */
export function hideSecrets(game: GameState, seat: number): GameState {
  if (game.phase === 'over') return game // the reveal: everything is shown
  const zeros = game.magic.map(() => 0)
  return {
    ...game,
    config: { ...game.config, seed: 0 }, // the seed + the moves would rebuild the bag
    hands: game.hands.map((hand, s) => (s === seat ? [...hand] : hand.map(() => HIDDEN))),
    bag: game.bag.map(() => HIDDEN),
    rng: 0,
    magic: zeros,
    tangleMagic: zeros,
    winners: [],
    log: emptyLog(), // the running totals + every word's Magic: never before the end (D47)
    pendingLog: null, // what a rival could have spelled with their hand (Weed toss): log-only, never before the end
    lastTurn: game.lastTurn && {
      ...game.lastTurn,
      magic: 0,
      words: game.lastTurn.words.map((word) => ({ ...word, magic: 0 })),
    },
  }
}

/** One player's view: their seat, the hidden game, and the results once it's over. */
export function viewOf(state: ServerGame, seatId: string): GameView {
  const mySeat = state.seatIds.indexOf(seatId)
  const over = state.game.phase === 'over'
  const results: Results | null = over ? { stats: state.stats } : null
  return {
    gameId: state.gameId,
    version: state.version,
    mySeat,
    names: state.names,
    change: state.change,
    by: state.by,
    game: hideSecrets(state.game, mySeat),
    options: state.options,
    turnEndsAt: state.turnEndsAt,
    results,
  }
}
