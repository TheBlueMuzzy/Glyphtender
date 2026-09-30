// WHOSE TURN — the glyphlings that pulse gently (GDD §4 feel notes): the current player's glyphlings that can
// move, from the start of their turn until a move is planned. Only when that player is on THIS device (online:
// only on your own turn), never in the draft or a refresh, never while a seed flies, the device is being passed
// on or my move is at the server. A tangled glyphling (no moves) and the one being held don't pulse.
import { legalMoves } from '../engine/engine'
import type { GameStore } from './gameStore'
import { isLocalHuman } from './seats'

type PulseState = Pick<GameStore, 'game' | 'move' | 'selected' | 'flying' | 'waiting' | 'handoff' | 'seats'>

export function pulsingGlyphlings(s: PulseState): number[] {
  const game = s.game
  if (!game || game.phase !== 'play' || s.move || s.flying || s.waiting || s.handoff) return []
  if (!isLocalHuman(s.seats, game.current)) return []
  const held = s.selected?.kind === 'glyphling' ? s.selected.id : null
  return game.glyphlings
    .filter((g) => g.seat === game.current && g.id !== held && legalMoves(game, g.id).length > 0)
    .map((g) => g.id)
}
