// ROOM PROTOCOL — every message between a player's browser and the room server.
// Shared by BOTH sides: the game (src/rooms/) and the server (party/server.ts → src/rooms/server/).
// No React, no Dev Kit, no browser-only code in here — the server imports it.
//
// The room part (join, seats, host, ready, start…) is the same for every game.
// The game's own part is opaque here: an `action` (player → server) and a `view` / `event`
// (server → player). Each game says what's inside with its own types.

// ─── Seats and the room ─────────────────────────────────────────────

export type SeatKind = 'human' | 'bot'

/** One chair at the table, as every player sees it. */
export interface Seat {
  /** Stable for the whole room ("seat-1", "seat-2"…) — use it to tell seats apart. */
  id: string
  name: string
  /** 'bot' = a bot plays this seat (added by the host, or the player left / went idle). */
  kind: SeatKind
  isHost: boolean
  /** false = the player's connection dropped; their seat waits for them. */
  connected: boolean
  /** Lobby only: the player pressed Ready. */
  ready: boolean
  /** Turns in a row the server had to play for this player (resets when they act). */
  missedTurns: number
}
// Note: the player's persistentId (the thing that owns a seat) is NEVER sent to other players —
// anyone who knew it could take that seat and see that player's hand. It stays on the server.

/** lobby = gathering players · playing = a game is on · over = game finished (rematch or back to lobby) */
export type RoomPhase = 'lobby' | 'playing' | 'over'

export interface RoomState {
  code: string
  phase: RoomPhase
  /** In seat order. */
  seats: Seat[]
  minSeats: number
  maxSeats: number
}

// ─── Player → server ────────────────────────────────────────────────

export type ClientMessage =
  /** Sent every time the socket opens (first time AND every reconnect). A known persistentId gets its seat back. */
  | { type: 'join'; name: string; persistentId: string; create: boolean }
  /** On purpose: gives up the seat (a bot takes it mid-game). */
  | { type: 'leave' }
  | { type: 'ready'; ready: boolean }
  /** Host only. `options` are the game's new-game options (checked by the game). Works in the lobby and after a game (rematch). */
  | { type: 'start'; options: unknown }
  /** Host only. Removes a player (or a bot) — a kicked player can't come back to this room. */
  | { type: 'kick'; seatId: string }
  /** Host only, lobby only, if the game allows bots. */
  | { type: 'add_bot' }
  /** Host only, after a game: everyone back to the lobby. */
  | { type: 'back_to_lobby' }
  /** The game's own move. The server's game rules check it. */
  | { type: 'action'; action: unknown }

// ─── Server → player ────────────────────────────────────────────────

/** Why the server shut you out. After this the game should stop trying (useRoom does). */
export type CloseReason =
  | 'left' // you pressed Leave
  | 'kicked' // the host removed you
  | 'connected_elsewhere' // you opened the game in another tab — that tab has your seat now
  | 'no_room' // nobody is in a room with that code
  | 'code_taken' // (creating) someone is already using that code — make another
  | 'room_full'
  | 'game_started' // a game is on and you don't have a seat in it
  | 'name_needed'
  | 'room_closed' // everyone left

/** Something you asked for didn't happen, but you're still in the room. */
export type ErrorCode =
  | 'bad_message' // not a message the server understands
  | 'not_host'
  | 'not_now' // wrong moment (e.g. start while playing, action in the lobby)
  | 'cant_start' // not enough seats / not everyone ready / the game refused the options
  | 'bad_action' // the action wasn't the right shape
  | 'action_refused' // the game's rules said no (message says why, in plain English)

export type ServerMessage =
  /** The room changed. `you` = your seat id (null if you have no seat). */
  | { type: 'room'; room: RoomState; you: string | null }
  /** Your own view of the game — only what YOU may see. Sent after every change and when you come back. */
  | { type: 'view'; view: unknown }
  /** A one-off game message (e.g. "Sam played MOSS" for an animation). */
  | { type: 'event'; event: unknown }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'closed'; reason: CloseReason; message: string }

// ─── Checking what arrives ──────────────────────────────────────────

export const MAX_NAME_LENGTH = 16
/** Bigger messages than this are refused unread (a real one is far smaller). */
export const MAX_MESSAGE_LENGTH = 16_000

/** A player name as the room shows it: trimmed, single spaces, at most 16 characters. "" = no name. */
export function cleanName(name: unknown): string {
  if (typeof name !== 'string') return ''
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Server side: raw text from a player → a ClientMessage, or null if it isn't one.
 * Checks every field's type, so the rest of the server can trust it. (The game's `action`
 * and `options` are checked later by the game's own checkAction / checkOptions.)
 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(data)) return null

  switch (data.type) {
    case 'join':
      if (typeof data.name !== 'string' || typeof data.persistentId !== 'string' || typeof data.create !== 'boolean') return null
      if (data.persistentId.length < 8 || data.persistentId.length > 64) return null
      return { type: 'join', name: data.name, persistentId: data.persistentId, create: data.create }
    case 'leave':
      return { type: 'leave' }
    case 'ready':
      return typeof data.ready === 'boolean' ? { type: 'ready', ready: data.ready } : null
    case 'start':
      return { type: 'start', options: data.options }
    case 'kick':
      return typeof data.seatId === 'string' ? { type: 'kick', seatId: data.seatId } : null
    case 'add_bot':
      return { type: 'add_bot' }
    case 'back_to_lobby':
      return { type: 'back_to_lobby' }
    case 'action':
      return { type: 'action', action: data.action }
    default:
      return null
  }
}

/** Player side: raw text from the server → a ServerMessage, or null if it isn't one. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!isObject(data) || typeof data.type !== 'string') return null
    return data as unknown as ServerMessage
  } catch {
    return null
  }
}
