// TANGLE DANGER — which glyphlings are close to being tangled (GDD §4 rule 9, research: "show tangle danger,
// not scores"). Everyone sees everyone's: it's read straight off the board, so it gives no Magic away.
//   warning — exactly 1 legal move left (one more seed in the wrong place and it's tangled)
//   tangled — no legal move at all
import { legalMoves } from '../engine/engine'
import type { GameState } from '../engine/types'

export type Danger = 'warning' | 'tangled'

/** How close this glyphling is to being tangled, or null when it has room to move. */
export function dangerOf(game: GameState, glyphlingId: number): Danger | null {
  const moves = legalMoves(game, glyphlingId).length
  if (moves === 0) return 'tangled'
  if (moves === 1) return 'warning'
  return null
}

/** Every glyphling in danger, by id. None during the draft (the garden is still being laid out). */
export function dangers(game: GameState): Map<number, Danger> {
  const found = new Map<number, Danger>()
  if (game.phase === 'draft') return found
  for (const g of game.glyphlings) {
    const danger = dangerOf(game, g.id)
    if (danger) found.set(g.id, danger)
  }
  return found
}
