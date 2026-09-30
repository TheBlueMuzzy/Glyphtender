// SKETCH rules — just enough to move and cast. The real rules engine is F04 (src/engine).
import { DIRECTIONS, hexKey, ray, type Board, type Hex } from '../../src/engine/hex'

export type Colour = 'yellow' | 'blue'
export interface Glyphling { id: string; colour: Colour; hex: Hex }
export interface Seed { hex: Hex; letter: string; colour: Colour }

/** Every hex a glyphling at `from` can move to: straight lines, stopping at anything in the way. */
export function legalMoves(board: Board, from: Hex, blocked: Set<string>): Hex[] {
  const out: Hex[] = []
  for (const dir of DIRECTIONS) {
    for (const h of ray(board, from, dir)) {
      if (blocked.has(hexKey(h))) break
      out.push(h)
    }
  }
  return out
}

/**
 * Every empty hex a seed can be cast to from `from`: straight lines, any distance.
 * It flies over the caster's own pieces but stops at anyone else's.
 */
export function legalCasts(board: Board, from: Hex, owner: Map<string, Colour>, colour: Colour): Hex[] {
  const out: Hex[] = []
  for (const dir of DIRECTIONS) {
    for (const h of ray(board, from, dir)) {
      const who = owner.get(hexKey(h))
      if (who === undefined) out.push(h)
      else if (who !== colour) break
    }
  }
  return out
}

/** A bag of seeds from the counts in content/data/bag.json; draw() takes a random one. */
export function makeBag(counts: Record<string, number>) {
  const seeds = Object.entries(counts).flatMap(([letter, n]) => Array<string>(n).fill(letter))
  return {
    draw(): string {
      if (seeds.length === 0) return 'E'
      return seeds.splice(Math.floor(Math.random() * seeds.length), 1)[0]
    },
  }
}
