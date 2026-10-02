// Tangles: a glyphling with no legal move is tangled. Enough tangles end the game.
import { getBoard } from './boards'
import { hexKey, neighbours } from './hex'
import { emptyLog, logEnd, logOf, logTurn } from './log'
import { legalMoves, occupancy } from './moves'
import type { GameState, LogTangle } from './types'

/** Ids of every glyphling that can't move right now. */
export function tangledIds(state: GameState): number[] {
  return state.glyphlings.filter((g) => legalMoves(state, g.id).length === 0).map((g) => g.id)
}

/**
 * Each tangled glyphling's bonus: every OTHER seat gets tangleBonus × (its seeds + glyphlings next to it).
 * The owner gets nothing from their own pieces.
 */
export function tangleDetails(state: GameState, tangled: number[]): LogTangle[] {
  const board = getBoard(state.config.boardName)
  const taken = occupancy(state)
  const details: LogTangle[] = []
  for (const id of tangled) {
    const g = state.glyphlings.find((x) => x.id === id)
    if (!g) continue
    const pieces: number[] = Array(state.config.players).fill(0)
    for (const n of neighbours(board, g.hex)) {
      const who = taken.get(hexKey(n))
      if (who && who.seat !== g.seat) pieces[who.seat] += 1
    }
    details.push({ glyphling: id, owner: g.seat, pieces, bonus: pieces.map((p) => p * state.config.rules.tangleBonus) })
  }
  return details
}

/** The tangle bonus per seat: every tangled glyphling's bonus added up (tangleDetails). */
export function tangleBonus(state: GameState, tangled: number[]): number[] {
  const bonus: number[] = Array(state.config.players).fill(0)
  for (const t of tangleDetails(state, tangled)) t.bonus.forEach((b, seat) => (bonus[seat] += b))
  return bonus
}

/** Seats with the most Magic (ties share the win). */
export function winnersOf(magic: number[]): number[] {
  const top = Math.max(...magic)
  return magic.flatMap((m, seat) => (m === top ? [seat] : []))
}

/**
 * Called when a turn is complete: re-checks every glyphling (one can come untangled), logs the turn (log.ts),
 * then either ends the game or passes play to the next seat. `refreshed` = seeds set aside on a refresh (null = none).
 */
export function endTurn(state: GameState, refreshed: number | null = null): GameState {
  const tangled = tangledIds(state)
  const turnCount = state.turnCount + 1
  const entry = logTurn(state, tangled, refreshed)
  const before = logOf(state)
  const log = entry ? { turns: [...before.turns, entry], end: null } : { ...emptyLog(), ...before }
  // Also ends if no glyphling at all can move (only possible when tanglesToEnd is set above 2).
  const nobodyCanMove = tangled.length === state.glyphlings.length
  if (tangled.length >= state.config.rules.tanglesToEnd || nobodyCanMove) {
    const tangles = tangleDetails(state, tangled)
    const tangleMagic = tangleBonus(state, tangled)
    const magic = state.magic.map((m, seat) => m + tangleMagic[seat])
    const end = entry ? logEnd(state, entry, tangles, tangleMagic, magic) : null
    return { ...state, phase: 'over', tangled, tangleMagic, magic, winners: winnersOf(magic), turnCount, log: { ...log, end }, pendingLog: null }
  }
  // Pass play on, skipping any seat whose glyphlings are all tangled — it has no move to make.
  const canMove = (seat: number) => state.glyphlings.some((g) => g.seat === seat && !tangled.includes(g.id))
  let next = (state.current + 1) % state.config.players
  while (!canMove(next)) next = (next + 1) % state.config.players
  return { ...state, phase: 'play', tangled, current: next, turnCount, log, pendingLog: null }
}
