// A turn: move one glyphling, then cast a seed from where it landed.
import { hexKey, type Hex } from './hex'
import { findGlyphling, includesHex, legalCasts, legalMoves } from './moves'
import type { GameState, TurnSummary, WordList } from './types'

export type TurnAction = { type: 'turn'; glyphling: number; to: Hex; seed: number | null; target: Hex | null }

/** Why this turn isn't allowed, or null if it is. */
export function checkTurn(state: GameState, action: TurnAction): string | null {
  if (state.phase !== 'play') return state.phase === 'refresh' ? 'Choose seeds to refresh first' : 'It is not time to move'
  const g = state.glyphlings.find((x) => x.id === action.glyphling)
  if (!g) return `There is no glyphling ${action.glyphling}`
  if (g.seat !== state.current) return 'That glyphling belongs to another player'
  if (!includesHex(legalMoves(state, g.id), action.to)) return 'A glyphling moves in a straight line and cannot pass through or land on anything'
  const hand = state.hands[state.current]
  const casts = legalCasts(state, g.id, action.to)
  if (action.seed === null) {
    if (action.target !== null) return 'Pick a seed to cast'
    // You must cast if you can: moving only is allowed with an empty hand or nowhere to cast.
    if (hand.length > 0 && casts.length > 0) return 'You must cast a seed when you can'
    return null
  }
  if (!Number.isInteger(action.seed) || action.seed < 0 || action.seed >= hand.length) return 'That seed is not in your hand'
  if (!action.target) return 'Pick where to cast the seed'
  if (!includesHex(casts, action.target)) return "A seed flies in a straight line onto an empty hex, over your own pieces but not other players'"
  return null
}

/** Moves the glyphling and plants the seed (no scoring) — the board as it is right after the cast. */
export function moveAndCast(state: GameState, action: TurnAction): GameState {
  const problem = checkTurn(state, action)
  if (problem) throw new Error(problem)
  const glyphlings = state.glyphlings.map((g) => (g.id === action.glyphling ? { ...g, hex: { ...action.to } } : g))
  if (action.seed === null || !action.target) return { ...state, glyphlings }
  const hand = [...state.hands[state.current]]
  const [letter] = hand.splice(action.seed, 1)
  const hands = state.hands.map((h, seat) => (seat === state.current ? hand : h))
  const seeds = { ...state.seeds, [hexKey(action.target)]: { letter, seat: state.current } }
  return { ...state, glyphlings, hands, seeds }
}

/** Plays a whole turn and passes play to the next seat. */
export function applyTurn(state: GameState, action: TurnAction, _words: WordList): GameState {
  const after = moveAndCast(state, action) // throws if the turn is illegal
  const from = findGlyphling(state, action.glyphling).hex
  const letter = action.seed === null ? null : state.hands[state.current][action.seed]
  const lastTurn: TurnSummary = {
    seat: state.current,
    glyphlingId: action.glyphling,
    from: { ...from },
    to: { ...action.to },
    letter,
    target: action.target ? { ...action.target } : null,
    words: [],
    magic: 0,
    drew: 0,
  }
  return endTurn({ ...after, lastTurn })
}

/** Finishes a turn: next seat's go. */
export function endTurn(state: GameState): GameState {
  return {
    ...state,
    phase: 'play',
    current: (state.current + 1) % state.config.players,
    turnCount: state.turnCount + 1,
  }
}
