// A turn: move one glyphling, then cast a seed from where it landed.
import { hexKey, type Hex } from './hex'
import { findGlyphling, includesHex, legalCasts, legalMoves } from './moves'
import { endTurn } from './tangle'
import { findWords, type FoundWord } from './wordFinder'
import type { GameState, MadeWord, TurnSummary, WordList } from './types'

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

/** The Magic each word makes: its seeds + ownershipBonus for each of the caster's own seeds in it. */
export function magicFor(state: GameState, found: FoundWord[], seat: number): MadeWord[] {
  return found.map((w) => {
    const own = w.hexes.filter((h) => state.seeds[hexKey(h)]?.seat === seat).length
    return { word: w.word, hexes: w.hexes, magic: w.hexes.length + state.config.rules.ownershipBonus * own }
  })
}

/** What a turn would make, without playing it — for the "Cast · +N" button. Throws if the turn is illegal. */
export function previewTurn(state: GameState, action: TurnAction, words: WordList): { words: MadeWord[]; magic: number } {
  const after = moveAndCast(state, action)
  if (!action.target || action.seed === null) return { words: [], magic: 0 }
  const made = magicFor(after, findWords(after, action.target, words), state.current)
  return { words: made, magic: made.reduce((sum, w) => sum + w.magic, 0) }
}

/** Plays a whole turn: move, cast, grow words into Magic, draw, and pass play on. */
export function applyTurn(state: GameState, action: TurnAction, words: WordList): GameState {
  const after = moveAndCast(state, action) // throws if the turn is illegal
  const seat = state.current
  const preview = previewTurn(state, action, words)
  const lastTurn: TurnSummary = {
    seat,
    glyphlingId: action.glyphling,
    from: { ...findGlyphling(state, action.glyphling).hex },
    to: { ...action.to },
    letter: action.seed === null ? null : state.hands[seat][action.seed],
    target: action.target ? { ...action.target } : null,
    words: preview.words,
    magic: preview.magic,
    drew: 0,
  }
  const magic = after.magic.map((m, s) => (s === seat ? m + preview.magic : m))
  if (preview.words.length > 0) {
    // Made Magic → draw 1 seed (if the bag isn't empty).
    const drawn = after.bag.slice(0, 1)
    const hands = after.hands.map((h, s) => (s === seat ? [...h, ...drawn] : h))
    return endTurn({ ...after, magic, hands, bag: after.bag.slice(drawn.length), lastTurn: { ...lastTurn, drew: drawn.length } })
  }
  // No Magic → the same player may refresh their hand (skipped when the bag is empty: nothing to refill from).
  if (after.bag.length > 0) return { ...after, magic, lastTurn, phase: 'refresh' }
  return endTurn({ ...after, magic, lastTurn })
}
