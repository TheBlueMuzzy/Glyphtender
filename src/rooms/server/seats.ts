// SEATS — who sits where, who's host, and what happens when people come and go.  (Server.)
// Plain functions on plain data, with no connections or timers in sight, so every rule here
// is tested on its own (seats.test.ts). RoomServer calls these and does the sending.
//
// The rules (from Roll Better, which proved them with real players):
// - A player's persistentId owns their seat. Come back with it — after a reload, a dropped
//   connection, even after a bot took over — and you get your seat back.
// - Lobby: a player who drops out loses their seat (they rejoin at the end when they're back).
// - Mid-game: a seat is never removed. Dropping out marks it "not connected"; leaving on purpose,
//   or missing too many turns, hands it to a bot. The game carries on.
// - Host: stays host while connected. If not, the first connected human (in seat order) becomes host.
import type { CloseReason, RoomPhase, RoomState, Seat } from '../protocol'
import { cleanName } from '../protocol'
import { isRoomCode } from '../roomCodes'
import type { RoomSettings } from './settings'

/** A seat as the server knows it: the public seat + who owns it. */
export interface SeatRecord extends Seat {
  /** The owner's persistentId. Bots the host added have "bot:<n>". Never sent to players. */
  persistentId: string
}

export interface RoomData {
  code: string
  phase: RoomPhase
  seats: SeatRecord[]
  /** persistentIds the host kicked — they can't come back to this room. */
  kicked: string[]
  /** How many seats were ever made (for unique seat ids). */
  seatsMade: number
}

export function newRoom(code: string): RoomData {
  return { code, phase: 'lobby', seats: [], kicked: [], seatsMade: 0 }
}

export function findSeat(room: RoomData, seatId: string): SeatRecord | undefined {
  return room.seats.find((seat) => seat.id === seatId)
}

export function findSeatOf(room: RoomData, persistentId: string): SeatRecord | undefined {
  return room.seats.find((seat) => seat.persistentId === persistentId)
}

export function connectedHumans(room: RoomData): SeatRecord[] {
  return room.seats.filter((seat) => seat.kind === 'human' && seat.connected)
}

export function isAddedBot(seat: SeatRecord): boolean {
  return seat.persistentId.startsWith('bot:')
}

function makeSeat(room: RoomData, persistentId: string, name: string, kind: Seat['kind']): SeatRecord {
  room.seatsMade += 1
  return {
    id: `seat-${room.seatsMade}`,
    persistentId,
    name,
    kind,
    isHost: false,
    connected: kind === 'human', // a bot the host added has no connection
    ready: kind === 'bot',
    missedTurns: 0,
  }
}

// ─── Join ───────────────────────────────────────────────────────────

export interface JoinRequest {
  name: string
  persistentId: string
  /** true = the player is making a new room with this code. */
  create: boolean
}

export type JoinResult =
  | { ok: true; seat: SeatRecord; cameBack: boolean }
  | { ok: false; reason: CloseReason }

/**
 * A player asks to join (or rejoin). Changes `room` and says which seat they got,
 * or why not. `cameBack` = they already had this seat (reload, reconnect, took it back from a bot).
 */
export function joinRoom(room: RoomData, request: JoinRequest, settings: RoomSettings): JoinResult {
  if (!isRoomCode(room.code)) return { ok: false, reason: 'no_room' }
  if (room.kicked.includes(request.persistentId)) return { ok: false, reason: 'kicked' }

  // Their own seat: take it back (even from a bot)
  const own = findSeatOf(room, request.persistentId)
  if (own) {
    own.kind = 'human'
    own.connected = true
    own.missedTurns = 0
    chooseHost(room)
    return { ok: true, seat: own, cameBack: true }
  }

  const name = cleanName(request.name)
  if (!name) return { ok: false, reason: 'name_needed' }
  const empty = room.seats.length === 0
  if (request.create && !empty) return { ok: false, reason: 'code_taken' }
  if (!request.create && empty) return { ok: false, reason: 'no_room' }
  if (room.phase !== 'lobby') return { ok: false, reason: 'game_started' }
  if (room.seats.length >= settings.maxSeats) return { ok: false, reason: 'room_full' }

  const seat = makeSeat(room, request.persistentId, name, 'human')
  room.seats.push(seat)
  chooseHost(room)
  return { ok: true, seat, cameBack: false }
}

// ─── Leaving, dropping out, bots ────────────────────────────────────

export function removeSeat(room: RoomData, seatId: string): void {
  room.seats = room.seats.filter((seat) => seat.id !== seatId)
  chooseHost(room)
}

/** The connection dropped. Lobby: the seat goes. Mid-game: it waits for them (connected = false). */
export function dropOut(room: RoomData, seatId: string): 'removed' | 'waiting' {
  if (room.phase === 'lobby') {
    removeSeat(room, seatId)
    return 'removed'
  }
  const seat = findSeat(room, seatId)
  if (seat) seat.connected = false
  chooseHost(room)
  return 'waiting'
}

/**
 * A bot plays this seat from now on. The owner can still come back and take it
 * (by rejoining, or — if they're still watching — just by making a move).
 * `connected` isn't touched: it says whether the owner's connection is still there.
 */
export function handToBot(room: RoomData, seatId: string): void {
  const seat = findSeat(room, seatId)
  if (!seat) return
  seat.kind = 'bot'
  seat.isHost = false
  chooseHost(room)
}

/** The owner, still connected, makes a move while a bot has their seat: it's theirs again. */
export function takeBack(room: RoomData, seatId: string): void {
  const seat = findSeat(room, seatId)
  if (!seat || isAddedBot(seat)) return
  seat.kind = 'human'
  seat.connected = true
  seat.missedTurns = 0
  chooseHost(room)
}

/** Host adds a bot seat in the lobby. null = not allowed or no room. */
export function addBot(room: RoomData, settings: RoomSettings): SeatRecord | null {
  if (!settings.allowBots || room.phase !== 'lobby' || room.seats.length >= settings.maxSeats) return null
  const botNumber = room.seats.filter(isAddedBot).length + 1
  const seat = makeSeat(room, `bot:${room.seatsMade + 1}`, `Bot ${botNumber}`, 'bot')
  room.seats.push(seat)
  return seat
}

/** The host removes someone. Lobby: seat gone. Mid-game: a bot takes it. They can't come back. */
export function kick(room: RoomData, seatId: string): SeatRecord | null {
  const seat = findSeat(room, seatId)
  if (!seat || seat.isHost) return null
  if (room.phase !== 'lobby' && isAddedBot(seat)) return null // mid-game a seat is never removed: the game still has it
  if (!isAddedBot(seat)) room.kicked.push(seat.persistentId)
  if (room.phase === 'lobby') {
    removeSeat(room, seatId)
  } else {
    handToBot(room, seatId)
    seat.connected = false
  }
  return seat
}

/**
 * The server had to play this seat's turn for them (they were idle).
 * true = that was one too many: a bot has taken the seat.
 */
export function missTurn(room: RoomData, seatId: string, settings: RoomSettings): boolean {
  const seat = findSeat(room, seatId)
  if (!seat || seat.kind !== 'human') return false
  seat.missedTurns += 1
  if (seat.missedTurns < settings.missedTurnsBeforeBot) return false
  handToBot(room, seatId)
  return true
}

// ─── Host ───────────────────────────────────────────────────────────

/** Keep the host if they're a connected human; otherwise the first connected human is host. */
export function chooseHost(room: RoomData): void {
  const current = room.seats.find((seat) => seat.isHost)
  if (current && current.kind === 'human' && current.connected) return
  for (const seat of room.seats) seat.isHost = false
  const next = connectedHumans(room)[0]
  if (next) next.isHost = true
}

// ─── Starting and ending ────────────────────────────────────────────

/** Why the host can't start right now (plain English), or null if they can. */
export function whyNotStart(room: RoomData, settings: RoomSettings): string | null {
  if (room.phase === 'playing') return 'A game is already on.'
  if (room.seats.length < settings.minSeats) return `Needs at least ${settings.minSeats} players.`
  const notReady = room.seats.filter((seat) => seat.kind === 'human' && !seat.isHost && !seat.ready)
  if (room.phase === 'lobby' && notReady.length > 0) return `Waiting for ${notReady.map((seat) => seat.name).join(', ')} to be ready.`
  return null
}

export function startPlaying(room: RoomData): void {
  room.phase = 'playing'
  for (const seat of room.seats) {
    seat.missedTurns = 0
    seat.ready = seat.kind === 'bot'
  }
}

/** After a game: back to the lobby. Players who are gone (or whose seat a bot took) lose their seats. */
export function backToLobby(room: RoomData): void {
  room.phase = 'lobby'
  room.seats = room.seats.filter((seat) => (seat.kind === 'human' && seat.connected) || isAddedBot(seat))
  for (const seat of room.seats) {
    seat.missedTurns = 0
    seat.ready = seat.kind === 'bot'
  }
  chooseHost(room)
}

// ─── What players see ───────────────────────────────────────────────

/** A seat without its owner's persistentId. */
export function publicSeat(seat: SeatRecord): Seat {
  const { id, name, kind, isHost, connected, ready, missedTurns } = seat
  return { id, name, kind, isHost, connected, ready, missedTurns }
}

export function publicRoom(room: RoomData, settings: RoomSettings): RoomState {
  return {
    code: room.code,
    phase: room.phase,
    seats: room.seats.map(publicSeat),
    minSeats: settings.minSeats,
    maxSeats: settings.maxSeats,
  }
}
