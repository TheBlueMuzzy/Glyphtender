// Tangles: a glyphling with no legal move is tangled. Enough tangles end the game.
import { getBoard } from './boards'
import { hexKey, neighbours } from './hex'
import { legalMoves, occupancy } from './moves'
import type { GameState } from './types'

/** Ids of every glyphling that can't move right now. */
export function tangledIds(state: GameState): number[] {
  return state.glyphlings.filter((g) => legalMoves(state, g.id).length === 0).map((g) => g.id)
}

/**
 * The tangle bonus per seat: for each tangled glyphling, every OTHER seat gets
 * tangleBonus × (its seeds + glyphlings next to it). The owner gets nothing from their own pieces.
 */
export function tangleBonus(state: GameState, tangled: number[]): number[] {
  const board = getBoard(state.config.boardName)
  const taken = occupancy(state)
  const bonus: number[] = Array(state.config.players).fill(0)
  for (const id of tangled) {
    const g = state.glyphlings.find((x) => x.id === id)
    if (!g) continue
    for (const n of neighbours(board, g.hex)) {
      const who = taken.get(hexKey(n))
      if (who && who.seat !== g.seat) bonus[who.seat] += state.config.rules.tangleBonus
    }
  }
  return bonus
}

/** Seats with the most Magic (ties share the win). */
export function winnersOf(magic: number[]): number[] {
  const top = Math.max(...magic)
  return magic.flatMap((m, seat) => (m === top ? [seat] : []))
}

/**
 * Called when a turn is complete: re-checks every glyphling (one can come untangled),
 * then either ends the game or passes play to the next seat.
 */
export function endTurn(state: GameState): GameState {
  const tangled = tangledIds(state)
  const turnCount = state.turnCount + 1
  if (tangled.length >= state.config.rules.tanglesToEnd) {
    const tangleMagic = tangleBonus(state, tangled)
    const magic = state.magic.map((m, seat) => m + tangleMagic[seat])
    return { ...state, phase: 'over', tangled, tangleMagic, magic, winners: winnersOf(magic), turnCount }
  }
  return { ...state, phase: 'play', tangled, current: (state.current + 1) % state.config.players, turnCount }
}
