// THE "NO" SHAKE — tapping (or trying to drag) something you can't move gives it a quick sideways shake
// (GDD §4 feel notes). This decides WHICH taps are refused; the screen shakes the piece (useNopeShake.ts).
// Refused: another player's glyphling · a tangled one (no moves) · any glyphling outside your move step (the
// draft, a refresh) · a seed already planted on the board · a tray seed TAPPED before you've moved (dragging it is
// fine: that reorders the tray) · anything of yours
// while it isn't your turn (online). Quiet moments shake nothing: a seed in the air, the device being passed on,
// my move on its way to the server, and the finished game (you're just looking).
import { legalMoves } from '../engine/engine'
import { hexKey, type Hex } from '../engine/hex'
import type { GameStore } from './gameStore'
import { isLocalHuman } from './seats'

/** What was tapped: a board glyphling (id), a tray seed (hand index; drag = picked up to drag) or a board hex. */
export type Tap = { glyph: number } | { hand: number; drag?: boolean } | { hex: Hex }

/** The piece to shake: a glyphling (id), a planted seed (hexKey) or a tray seed (hand index). */
export type NopeTarget = { kind: 'glyph' | 'seed' | 'hand'; key: string }

type NopeState = Pick<GameStore, 'game' | 'move' | 'flying' | 'waiting' | 'handoff' | 'seats'>

export function nopeFor(s: NopeState, tap: Tap): NopeTarget | null {
  const game = s.game
  if (!game || game.phase === 'over' || s.flying || s.waiting || s.handoff) return null
  const myTurn = isLocalHuman(s.seats, game.current)
  if ('glyph' in tap) {
    const g = game.glyphlings.find((x) => x.id === tap.glyph)
    if (!g) return null
    const movable = myTurn && game.phase === 'play' && g.seat === game.current && legalMoves(game, g.id).length > 0
    return movable ? null : { kind: 'glyph', key: String(g.id) }
  }
  if ('hand' in tap) {
    if (game.phase === 'draft') return null // the draft tray holds glyphlings to place, not seeds
    const waitingForMove = game.phase === 'play' && !s.move && !tap.drag // a drag may just reorder the tray
    return !myTurn || waitingForMove ? { kind: 'hand', key: String(tap.hand) } : null
  }
  const key = hexKey(tap.hex)
  return game.seeds[key] ? { kind: 'seed', key } : null // planted seeds stay put (the aimed one isn't planted yet)
}
