// SEATS — who sits in each chair (GDD §5, TDD D05). A seat is a local player on this device, an online
// player (alpha, online milestone) or an AI (beta). The rules engine doesn't know or care which.
// For now every seat is 'local': pass-and-play on one device. Online and AI seats plug in here later —
// the turn flow only ever asks "is the current seat a local human on this device?".
import { SEAT_COLOURS, type SeatColour } from '../engine/types'

export type SeatKind = 'local' | 'online' | 'ai'

export interface Seat {
  kind: SeatKind
  /** What players read, e.g. "Blue". */
  name: string
  colour: SeatColour
}

/** One local seat per player, in turn order (Yellow, Blue, Purple, Pink). `names` = colour → name (en.json). */
export function localSeats(players: number, names: Record<SeatColour, string>): Seat[] {
  return SEAT_COLOURS.slice(0, players).map((colour) => ({ kind: 'local', name: names[colour], colour }))
}

/** Is this seat a human playing on THIS device? (Only they may tap the board and tray on their turn.) */
export const isLocalHuman = (seats: Seat[], seat: number) => seats[seat]?.kind === 'local'

/**
 * Does the device need passing to `to` before they see their seeds?
 * Only between two different humans on this device, and only when seeds are hidden between turns.
 * (One human vs AIs, or everyone agreeing seeds are public, never needs the handoff screen.)
 */
export function needsHandoff(seats: Seat[], from: number | null, to: number, hideSeeds: boolean): boolean {
  if (!hideSeeds || from === to || !isLocalHuman(seats, to)) return false
  return seats.filter((s) => s.kind === 'local').length > 1
}
