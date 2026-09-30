// Planning a turn on screen before it's cast — plain functions the game store uses (and tests check).
// Nothing here changes the game: the planned move and cast only become real when Cast sends the action.
import { legalCasts, legalDraftHexes, legalMoves } from '../engine/engine'
import { sameHex, type Hex } from '../engine/hex'
import type { Action, GameState } from '../engine/types'

/** A glyphling moved on screen but not cast yet. */
export interface PlannedMove {
  glyphling: number
  to: Hex
}

/** A seed aimed at a hex but not thrown yet. `seed` is its index in the hand. */
export interface PlannedCast {
  seed: number
  target: Hex
}

/** The piece being held: a glyphling on the board or a seed in the tray (by hand index). */
export type Selection = { kind: 'glyphling'; id: number } | { kind: 'seed'; index: number } | null

/** Which hexes to light up, and in which colour (teal = move there, gold = cast there). */
export interface Highlight {
  hexes: Hex[]
  kind: 'move' | 'cast'
}

/** Does this glyphling belong to the player whose turn it is? */
export const isCurrents = (game: GameState, id: number) =>
  game.glyphlings.some((g) => g.id === id && g.seat === game.current)

/** Every hex the planned glyphling could cast from where it now stands. */
export const castOptions = (game: GameState, move: PlannedMove | null): Hex[] =>
  move ? legalCasts(game, move.glyphling, move.to) : []

/** Moving without casting is only allowed with an empty hand or nowhere to cast. */
export function mayMoveOnly(game: GameState, move: PlannedMove | null): boolean {
  if (!move) return false
  return game.hands[game.current].length === 0 || castOptions(game, move).length === 0
}

/** The glowing hexes for what's held right now (draft: every legal spot glows, nothing to hold). */
export function highlightFor(game: GameState, move: PlannedMove | null, selected: Selection): Highlight | null {
  if (game.phase === 'draft') return { hexes: legalDraftHexes(game), kind: 'move' }
  if (game.phase !== 'play' || !selected) return null
  if (selected.kind === 'glyphling') return { hexes: legalMoves(game, selected.id), kind: 'move' }
  return move ? { hexes: castOptions(game, move), kind: 'cast' } : null
}

/** The engine action for the planned turn (a move-only turn has no seed). */
export function turnAction(move: PlannedMove, cast: PlannedCast | null): Action {
  return {
    type: 'turn',
    glyphling: move.glyphling,
    to: move.to,
    seed: cast ? cast.seed : null,
    target: cast ? cast.target : null,
  }
}

/** Is `hex` in `list`? */
export const hexIn = (list: Hex[], hex: Hex) => list.some((h) => sameHex(h, hex))

/**
 * Keeps a player's own tray order after their hand changes.
 * `order` lists hand indexes in the order the tray shows them. The engine removes seeds (keeping the
 * rest in order) and adds new ones at the end — so survivors keep their place and new seeds go last.
 */
export function reconcileOrder(order: number[], removed: number[], newLength: number): number[] {
  const kept = order
    .filter((i) => !removed.includes(i))
    .map((i) => i - removed.filter((r) => r < i).length) // indexes shift down past each removed seed
  const next = [...kept]
  for (let i = kept.length; i < newLength; i++) next.push(i)
  return next
}

/** A tray order with the seed at position `from` moved to position `to`. */
export function moveInOrder(order: number[], from: number, to: number): number[] {
  const next = [...order]
  const [picked] = next.splice(from, 1)
  next.splice(to, 0, picked)
  return next
}

/** A shuffled copy of a tray order (plain random — the tray order isn't part of the game rules). */
export function shuffled(order: number[], random: () => number = Math.random): number[] {
  const next = [...order]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** 0, 1, 2 … n-1 — the tray order of a freshly dealt hand. */
export const inHandOrder = (n: number) => Array.from({ length: n }, (_, i) => i)
