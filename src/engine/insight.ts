// WHAT A TURN DID TO THE BOARD — the facts the skill awards are measured from (src/game/stats.ts; GDD §4 Awards).
// Intent can't be read, so the awards measure the EFFECT of a turn: how many moves it took from a rival glyphling,
// the garden a glyphling can walk in (reachArea — Walled garden), whether it flew over the caster's own seeds, whether it took a spot a rival could
// have scored on (that one needs the word list: blockedSpot, turn.ts). Pure: reads a game, returns numbers.
// logTurn (log.ts) writes them into the game log.
// Every board here is rebuilt from the board AFTER the cast: take the new seed away = the board after the move;
// put the glyphling back where it started too = the board at the start of the turn (the cast's hex was empty then).
import { getBoard } from './boards'
import { DIRECTIONS, addHex, hexKey, sameHex, type Hex } from './hex'
import { legalMoves } from './moves'
import type { GameState, LogMobility } from './types'

/** The board with the cast's seed taken away (the board after the move, before the cast). */
export function withoutSeed(state: GameState, target: Hex | null): GameState {
  if (!target) return state
  const seeds = { ...state.seeds }
  delete seeds[hexKey(target)]
  return { ...state, seeds }
}

/** The board with one glyphling standing somewhere else. */
export function withGlyphlingAt(state: GameState, id: number, hex: Hex): GameState {
  return { ...state, glyphlings: state.glyphlings.map((g) => (g.id === id ? { ...g, hex: { ...hex } } : g)) }
}

/** Every glyphling's legal moves, by id. */
export const mobilityOf = (state: GameState): number[] => {
  const out: number[] = []
  for (const g of state.glyphlings) out[g.id] = legalMoves(state, g.id).length
  return out
}

/**
 * Legal moves of every glyphling (by id) at the start of the turn, after the move, and after the cast.
 * `after` = the board after the cast; the turn moved `glyphlingId` from `from` and cast onto `target` (null = no cast).
 */
export function turnMobility(after: GameState, glyphlingId: number, from: Hex, target: Hex | null): LogMobility {
  const afterMove = withoutSeed(after, target)
  const before = withGlyphlingAt(afterMove, glyphlingId, from)
  return { before: mobilityOf(before), afterMove: mobilityOf(afterMove), afterCast: mobilityOf(after) }
}

/** How many of the caster's own seeds the cast flew over, from where the glyphling stood (`to`) to `target`. */
export function seedsFlownOver(after: GameState, seat: number, to: Hex, target: Hex | null): number {
  if (!target) return 0
  const dir = DIRECTIONS.find((d) => {
    for (let h = addHex(to, d), i = 0; i < 40; h = addHex(h, d), i++) if (sameHex(h, target)) return true
    return false
  })
  if (!dir) return 0
  let count = 0
  for (let h = addHex(to, dir); !sameHex(h, target); h = addHex(h, dir)) if (after.seeds[hexKey(h)]?.seat === seat) count++
  return count
}

/**
 * The garden a glyphling could ever walk in: every hex joined to it through hexes with no seed on them (glyphlings
 * move, so a hex with a glyphling on it counts as open). Seeds never move or go away, so a seed wall is for good.
 */
export function reachArea(state: GameState, start: Hex): Set<string> {
  const board = getBoard(state.config.boardName)
  const seen = new Set<string>([hexKey(start)])
  const queue = [start]
  while (queue.length) {
    const h = queue.pop()!
    for (const d of DIRECTIONS) {
      const n = addHex(h, d)
      const key = hexKey(n)
      if (!board.has(n) || seen.has(key) || state.seeds[key]) continue
      seen.add(key)
      queue.push(n)
    }
  }
  return seen
}
