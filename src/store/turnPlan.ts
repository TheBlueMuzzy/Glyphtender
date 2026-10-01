// Planning a turn on screen before it's cast — plain functions the game store uses (and tests check).
// Nothing here changes the game: the planned move and cast only become real when Cast sends the action.
import { legalCasts, legalDraftHexes, legalMoves } from '../engine/engine'
import { sameHex, type Hex } from '../engine/hex'
import type { Action, GameState } from '../engine/types'
import { isLocalHuman, type Seat } from './seats'

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

/** Which hexes to light up, and how (the same filled template: move = the player's colour, cast = a lighter shade). */
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

/**
 * The glowing hexes right now. Draft: every legal spot (nothing to hold). Holding a glyphling: where it can move.
 * Otherwise, once a move is planned: where the moved glyphling can cast — straight away, before a seed is picked,
 * and still while a seed is held or aimed (GDD §4 feel notes: "cast ranges show right after the move").
 */
export function highlightFor(game: GameState, move: PlannedMove | null, selected: Selection): Highlight | null {
  if (game.phase === 'draft') return { hexes: legalDraftHexes(game), kind: 'move' }
  if (game.phase !== 'play') return null
  if (selected?.kind === 'glyphling') return { hexes: legalMoves(game, selected.id), kind: 'move' }
  const seedsLeft = game.hands[game.current].length > 0 // an empty hand has nothing to cast (End turn)
  return move && seedsLeft ? { hexes: castOptions(game, move), kind: 'cast' } : null
}

/**
 * What the board lights up on THIS device: nothing while a seed flies; in play, only the plan of a player on this
 * device that can still change — online, another player's turn is replayed with its move in the store (the glide),
 * and that move is not something to cast from here (no gold for them); nor is my own once it's gone to the server.
 */
type LitState = { game: GameState; move: PlannedMove | null; selected: Selection; flying: boolean; waiting: boolean; seats: Seat[] }

export function boardHighlight(s: LitState): Highlight | null {
  if (s.flying) return null
  if (s.game.phase === 'play' && (s.waiting || !isLocalHuman(s.seats, s.game.current))) return null
  return highlightFor(s.game, s.move, s.selected)
}

/**
 * While dragging: if `hex` (under the lifted piece) is a legal drop, which option it is — else null (no highlight).
 * Only on this device's own turn (online, my waiting glyphling can be dragged in the draft while someone else places).
 */
export function dropKind(s: LitState, hex: Hex | undefined): Highlight['kind'] | null {
  if (s.waiting || !isLocalHuman(s.seats, s.game.current)) return null
  const lit = hex ? boardHighlight(s) : null
  return lit && hex && hexIn(lit.hexes, hex) ? lit.kind : null
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
 * An empty place in a tray order: a seed was cast or set aside and nothing new has come for it yet. The tray never
 * closes up round it (Muzzy 2026-10-01: "don't resort. it's confusing/jarring") — refreshFx.refillInPlace fills it.
 */
export const TRAY_GAP = -1

/** A tray order with the seed at position `from` moved to position `to` (dropped into an empty place: it just moves there). */
export function moveInOrder(order: number[], from: number, to: number): number[] {
  const next = [...order]
  if (next[to] === TRAY_GAP) {
    ;[next[from], next[to]] = [TRAY_GAP, next[from]]
    return next
  }
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
