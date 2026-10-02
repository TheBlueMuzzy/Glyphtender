// A turn: move one glyphling, then cast a seed from where it landed.
import { hexKey, sameHex, type Hex } from './hex'
import { withoutSeed } from './insight'
import { findGlyphling, includesHex, legalCasts, legalMoves } from './moves'
import { endTurn } from './tangle'
import { findWords, type FoundWord } from './wordFinder'
import type { GameState, LogBlock, MadeWord, TurnSummary, WordList } from './types'

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

/** The Magic one seed adds to a word `seat` made: 1, + ownershipBonus when it's that player's own seed. */
export function seedMagic(state: GameState, hex: Hex, seat: number): number {
  return 1 + (state.seeds[hexKey(hex)]?.seat === seat ? state.config.rules.ownershipBonus : 0)
}

/** The Magic each word makes: its seeds + ownershipBonus for each of the caster's own seeds in it. */
export function magicFor(state: GameState, found: FoundWord[], seat: number): MadeWord[] {
  return found.map((w) => ({ word: w.word, hexes: w.hexes, magic: w.hexes.reduce((sum, h) => sum + seedMagic(state, h, seat), 0) }))
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
  // For the game log (the Weed toss award): the best word a rival could have grown on this cast's hex. It reads
  // rivals' hands, so it waits in pendingLog — hidden online like the log (party/views.ts) — until endTurn logs it.
  const pendingLog = { blocked: blockedSpot(after, seat, action.target, words) }
  if (preview.words.length > 0) {
    // Made Magic → draw 1 seed (if the bag isn't empty).
    const drawn = after.bag.slice(0, 1)
    const hands = after.hands.map((h, s) => (s === seat ? [...h, ...drawn] : h))
    return endTurn({ ...after, magic, hands, bag: after.bag.slice(drawn.length), lastTurn: { ...lastTurn, drew: drawn.length }, pendingLog })
  }
  // No Magic → the same player may refresh their hand (skipped when the bag is empty: nothing to refill from).
  if (after.bag.length > 0) return { ...after, magic, lastTurn, phase: 'refresh', pendingLog }
  return endTurn({ ...after, magic, lastTurn, pendingLog })
}

/**
 * Weed toss (stats.ts): the best word a RIVAL could have grown on the cast's hex on their next turn, had it stayed
 * empty — any letter in their hand, cast by one of their glyphlings after one legal move, on the board as it was
 * after this turn's move. null = no rival could have made a word there. It reads rivals' real hands, so it's only
 * ever written into the secret game log (shown once the game is over). `after` = the board after the cast.
 */
export function blockedSpot(after: GameState, seat: number, target: Hex | null, words: WordList): LogBlock | null {
  if (!target) return null
  const open = withoutSeed(after, target)
  let best: LogBlock | null = null
  for (let rival = 0; rival < after.config.players; rival++) {
    if (rival === seat) continue
    const letters = [...new Set(open.hands[rival] ?? [])].filter((l) => /^[A-Z]$/.test(l))
    let top: { magic: number; word: string } | null = null
    for (const letter of letters) {
      const planted = { ...open, seeds: { ...open.seeds, [hexKey(target)]: { letter, seat: rival } } }
      const made = magicFor(planted, findWords(planted, target, words), rival)
      const total = made.reduce((sum, w) => sum + w.magic, 0)
      if (total > (top?.magic ?? 0)) top = { magic: total, word: made.map((w) => w.word).join(' + ') }
    }
    if (!top || top.magic <= (best?.magic ?? 0)) continue
    // …and could they have got a seed there? One legal move, then a straight cast (over their own pieces only).
    const reach = open.glyphlings.some((g) => g.seat === rival
      && legalMoves(open, g.id).some((m) => legalCasts(open, g.id, m).some((h) => sameHex(h, target))))
    if (reach) best = { seat: rival, magic: top.magic, word: top.word }
  }
  return best
}
