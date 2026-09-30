// Where glyphlings can move and where seeds can be cast.
import { DIRECTIONS, hexKey, ray, sameHex, type Hex } from './hex'
import { getBoard } from './boards'
import type { GameState, Glyphling } from './types'

/** What stands on a hex: a glyphling or a seed (with its owner), or nothing. */
export interface Occupant {
  kind: 'glyphling' | 'seed'
  seat: number
}

/**
 * What's on each hex, as a lookup by hexKey.
 * `movedId`/`movedTo` pretend one glyphling is standing somewhere else (used to test a move before it's made).
 */
export function occupancy(state: GameState, movedId?: number, movedTo?: Hex): Map<string, Occupant> {
  const map = new Map<string, Occupant>()
  for (const [key, seed] of Object.entries(state.seeds)) map.set(key, { kind: 'seed', seat: seed.seat })
  for (const g of state.glyphlings) {
    const hex = g.id === movedId && movedTo ? movedTo : g.hex
    map.set(hexKey(hex), { kind: 'glyphling', seat: g.seat })
  }
  return map
}

export function findGlyphling(state: GameState, id: number): Glyphling {
  const g = state.glyphlings.find((x) => x.id === id)
  if (!g) throw new Error(`There is no glyphling ${id}`)
  return g
}

/** Every hex a glyphling can move to: ≥1 hex in a straight line, stopping before anything in the way. */
export function legalMoves(state: GameState, glyphlingId: number): Hex[] {
  const board = getBoard(state.config.boardName)
  const g = findGlyphling(state, glyphlingId)
  const taken = occupancy(state)
  const out: Hex[] = []
  for (const dir of DIRECTIONS) {
    for (const h of ray(board, g.hex, dir)) {
      if (taken.has(hexKey(h))) break
      out.push(h)
    }
  }
  return out
}

/**
 * Every empty hex a glyphling standing on `from` can cast a seed to: any distance in a straight line.
 * The seed flies over the caster's own seeds and glyphlings but stops at anyone else's.
 * The hex the glyphling moved away from counts as empty.
 */
export function legalCasts(state: GameState, glyphlingId: number, from: Hex): Hex[] {
  const board = getBoard(state.config.boardName)
  const g = findGlyphling(state, glyphlingId)
  const taken = occupancy(state, glyphlingId, from)
  const out: Hex[] = []
  for (const dir of DIRECTIONS) {
    for (const h of ray(board, from, dir)) {
      const who = taken.get(hexKey(h))
      if (!who) out.push(h)
      else if (who.seat !== g.seat) break // someone else's piece: the seed can't fly past
    }
  }
  return out
}

/** Is `hex` one of `list`? */
export const includesHex = (list: Hex[], hex: Hex) => list.some((h) => sameHex(h, hex))
