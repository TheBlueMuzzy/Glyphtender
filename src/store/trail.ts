// TURN TRAILS — where a turn went, drawn on the board in the player's colour (Muzzy, 2026-10-01: "if we could see the
// paths when other players take their turns, it might help us understand the current state of the game — who is
// playing, where did they move from, where did they shoot from"). Plain functions (tested in trail.test.ts);
// TurnTrail.tsx draws them.
//   plan  — my own turn being planned: a dotted path from the glyphling's spot to where it's moving, and a dashed
//           arc to the targeted hex (the planned halos already ring both ends)
//   live  — another player's turn being replayed online: their trail draws on (from ring → dotted path → to ring →
//           arc → target ring) and holds a moment BEFORE the glide and throw play (anim.json trailLead / trailHold)
//   faint — the last turn's trail stays on the board, faint, until the next action (a pick-up, a plan, a refresh,
//           the next replay), so a glance tells who moved where and cast from where. Pass-and-play's next player
//           sees the previous turn this way after the handoff.
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

export type TrailMode = 'plan' | 'live' | 'faint'

/** A finished turn's trail (null before the first turn). */
export function trailOf(turn: TurnSummary | null | undefined): Trail | null {
  if (!turn) return null
  return { seat: turn.seat, glyphlingId: turn.glyphlingId, from: turn.from, to: turn.to, target: turn.target }
}

/** Names a trail: the same turn keeps the same name while it goes from live to faint (so it fades, not redraws). */
export const trailKey = (t: Trail) => `${t.seat}:${t.glyphlingId}:${hexKey(t.from)}>${hexKey(t.to)}>${t.target ? hexKey(t.target) : '-'}`

type TrailState = Pick<GameStore, 'game' | 'trail' | 'move' | 'cast' | 'selected' | 'flying' | 'setAside' | 'refreshFx' | 'revealAt'>

/**
 * Which trail the board shows right now, and how:
 * a replay's trail (live) → else the turn being planned on this board (plan) → else, while nobody is doing
 * anything yet, the last turn's (faint). Nothing in the draft or once the game is over (the reveal owns the garden).
 */
export function boardTrail(s: TrailState): { trail: Trail; mode: TrailMode } | null {
  const game = s.game
  if (!game || game.phase === 'draft' || game.phase === 'over') return null
  if (s.trail) return { trail: s.trail, mode: 'live' }
  if (s.move) {
    const plan = planTrail(game, s.move, s.cast?.target ?? null)
    return plan && { trail: plan, mode: 'plan' }
  }
  const busy = s.cast || s.selected || s.flying || s.setAside.length > 0 || s.refreshFx !== null || s.revealAt !== null
  const last = busy ? null : trailOf(game.lastTurn)
  return last && { trail: last, mode: 'faint' }
}

/** The planned turn as a trail: the glyphling's real spot → where it's planned to go → the aimed hex. */
function planTrail(game: GameState, move: { glyphling: number; to: Hex }, target: Hex | null): Trail | null {
  const glyphling = game.glyphlings.find((g) => g.id === move.glyphling)
  if (!glyphling) return null
  return { seat: glyphling.seat, glyphlingId: glyphling.id, from: glyphling.hex, to: move.to, target }
}
