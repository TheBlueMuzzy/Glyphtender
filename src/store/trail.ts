// TURN TRAILS — where a turn went, drawn on the board in the player's colour (Muzzy, 2026-10-01: "if we could see the
// paths when other players take their turns, it might help us understand the current state of the game — who is
// playing, where did they move from, where did they shoot from"). Plain functions (tested in trail.test.ts);
// TurnTrail.tsx draws them.
//   plan  — my own turn being planned: a dotted path from the glyphling's spot to where it's moving (the planned
//           halos already ring both ends and the aimed hex)
//   live  — another player's turn being replayed online: their trail draws on (from ring → dotted path → to ring →
//           target ring) and holds a moment BEFORE the glide and throw play (anim.json trailLead / trailHold)
// NO cast arc (Muzzy 2026-10-01: "i don't want players thinking that shots jump things. they are 'straight line
// shots'") and NOTHING after the landing ("the dotted line/paths stick around and shouldn't post cast"): a trail
// is gone once the seed lands — for my own turn and for a replay.
import { hexKey, type Hex } from '../engine/hex'
import type { GameState, TurnSummary } from '../engine/types'
import type { GameStore } from './gameStore'

/** One turn's path: whose, which glyphling, from → to, and the hex its seed was cast at (null = it only moved). */
export interface Trail {
  seat: number
  glyphlingId: number
  from: Hex
  to: Hex
  target: Hex | null
}

export type TrailMode = 'plan' | 'live'

/** A finished turn's trail (null before the first turn). */
export function trailOf(turn: TurnSummary | null | undefined): Trail | null {
  if (!turn) return null
  return { seat: turn.seat, glyphlingId: turn.glyphlingId, from: turn.from, to: turn.to, target: turn.target }
}

/** Names a trail (a new name = a new trail, drawn on afresh). */
export const trailKey = (t: Trail) => `${t.seat}:${t.glyphlingId}:${hexKey(t.from)}>${hexKey(t.to)}>${t.target ? hexKey(t.target) : '-'}`

type TrailState = Pick<GameStore, 'game' | 'trail' | 'move' | 'cast'>

/**
 * Which trail the board shows right now, and how: a replay's trail (live) → else the turn being planned on this
 * board (plan) → else none (a landed turn leaves no trail). Nothing in the draft or once the game is over.
 */
export function boardTrail(s: TrailState): { trail: Trail; mode: TrailMode } | null {
  const game = s.game
  if (!game || game.phase === 'draft' || game.phase === 'over') return null
  if (s.trail) return { trail: s.trail, mode: 'live' }
  if (s.move) {
    const plan = planTrail(game, s.move, s.cast?.target ?? null)
    return plan && { trail: plan, mode: 'plan' }
  }
  return null
}

/** The planned turn as a trail: the glyphling's real spot → where it's planned to go → the aimed hex. */
function planTrail(game: GameState, move: { glyphling: number; to: Hex }, target: Hex | null): Trail | null {
  const glyphling = game.glyphlings.find((g) => g.id === move.glyphling)
  if (!glyphling) return null
  return { seat: glyphling.seat, glyphlingId: glyphling.id, from: glyphling.hex, to: move.to, target }
}
