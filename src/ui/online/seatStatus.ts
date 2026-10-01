// WHO'S REALLY AT EACH SEAT (B015, design/online.md seat_status here · away · auto). The room the server sends
// already says it for every seat: `kind` ('bot' = a bot plays it) and `connected`. This turns that into
//   · a status for the portrait (TurnBar.tsx): here · away (their connection dropped; the seat waits) · bot
//   · the toasts other players get when a bot takes a seat and when its player comes back (OnlineSession.tsx)
// Online, room seats are in game seat order (the server's game takes them in that order and they never move mid-game).
import type { RoomState, Seat } from '../../rooms/protocol'

export type SeatStatus = 'here' | 'away' | 'bot'

export function seatStatus(seat: Seat | undefined): SeatStatus | null {
  if (!seat) return null
  if (seat.kind === 'bot') return 'bot'
  return seat.connected ? 'here' : 'away'
}

/** botLeft = they left / stayed away, a bot plays for them · botIdle = still connected but idle · back = their seat is theirs again */
export type SeatNotice = { name: string; kind: 'botLeft' | 'botIdle' | 'back' }

/**
 * What to tell this player about the OTHER seats, from one room update to the next. Only mid-game (and not on
 * the first room after a reload — that's not news). A short drop-out (away and back) gets no toast.
 */
export function seatNotices(before: RoomState | null, after: RoomState | null, you: string | null): SeatNotice[] {
  if (!before || !after || before.phase !== 'playing' || after.phase !== 'playing') return []
  const notices: SeatNotice[] = []
  for (const seat of after.seats) {
    if (seat.id === you) continue
    const was = before.seats.find((old) => old.id === seat.id)
    if (!was) continue
    if (was.kind !== 'bot' && seat.kind === 'bot') notices.push({ name: seat.name, kind: seat.connected ? 'botIdle' : 'botLeft' })
    if (was.kind === 'bot' && seat.kind === 'human') notices.push({ name: seat.name, kind: 'back' })
  }
  return notices
}
