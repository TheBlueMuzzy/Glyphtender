// THE "NO" SHAKE — tapping (or trying to drag) something you can't move gives it a quick sideways shake
// (GDD §4 feel notes). This decides WHICH taps are refused; the screen shakes the piece (useNopeShake.ts).
// Refused: another player's glyphling · a tangled one (no moves) · any glyphling outside your move step (the
// draft, a refresh) · a seed already planted on the board · a tray seed before you've moved (tapped OR dragged —
// before the move seeds can't be dragged at all, not even to reorder the tray: Muzzy, B008) · anything of yours
// while it isn't your turn (online). Quiet moments shake nothing: a seed in the air, the device being passed on,
// my move on its way to the server, a refresh playing out on the tray, a cast's score playing out, and the finished game
// (you're just looking).
import { legalMoves } from '../engine/engine'
import { hexKey, type Hex } from '../engine/hex'
import type { GameStore } from './gameStore'
import { isLocalHuman } from './seats'

/** What was tapped (or picked up to drag): a board glyphling (id), a tray seed (hand index) or a board hex. */
export type Tap = { glyph: number } | { hand: number } | { hex: Hex }

/** The piece to shake: a glyphling (id), a planted seed (hexKey) or a tray seed (hand index). */
export type NopeTarget = { kind: 'glyph' | 'seed' | 'hand'; key: string }

type NopeState = Pick<GameStore, 'game' | 'move' | 'flying' | 'waiting' | 'handoff' | 'seats'> & Partial<Pick<GameStore, 'refreshFx' | 'scoring'>>

export function nopeFor(s: NopeState, tap: Tap): NopeTarget | null {
  const game = s.game
  if (!game || game.phase === 'over' || s.flying || s.waiting || s.handoff || s.refreshFx || (s.scoring ?? null) !== null) return null
  const myTurn = isLocalHuman(s.seats, game.current)
  if ('glyph' in tap) {
    const g = game.glyphlings.find((x) => x.id === tap.glyph)
    if (!g) return null
    const movable = myTurn && game.phase === 'play' && g.seat === game.current && legalMoves(game, g.id).length > 0
    return movable ? null : { kind: 'glyph', key: String(g.id) }
  }
  if ('hand' in tap) {
    if (game.phase === 'draft') return null // the draft tray holds glyphlings to place, not seeds
    const waitingForMove = game.phase === 'play' && !s.move
    return !myTurn || waitingForMove ? { kind: 'hand', key: String(tap.hand) } : null
  }
  const key = hexKey(tap.hex)
  return game.seeds[key] ? { kind: 'seed', key } : null // planted seeds stay put (the aimed one isn't planted yet)
}
