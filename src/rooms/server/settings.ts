// ROOM SETTINGS — the knobs a game sets for its rooms.  (Server.)
// A game keeps them in content/rooms.json (the installer makes one) and passes them to RoomServer,
// so Muzzy can change them without touching code. Anything left out uses the default below.

export interface RoomSettings {
  /** Fewest seats (players + bots) a game can start with. */
  minSeats: number
  /** Most seats in a room. */
  maxSeats: number
  /** Turns in a row the server plays for an idle player before a bot takes their seat (Roll Better: 2). */
  missedTurnsBeforeBot: number
  /** A player who drops out mid-game gets their seat handed to a bot after this long (0 = never). They can still come back and take it. */
  botTakesOverAfterMs: number
  /** Everyone gone mid-game: the room waits this long for someone to come back, then it's cleared. */
  keepEmptyRoomMs: number
  /** May the host add bot seats in the lobby? (The game must then play for bots — see README.) */
  allowBots: boolean
}

export const DEFAULT_SETTINGS: RoomSettings = {
  minSeats: 2,
  maxSeats: 4,
  missedTurnsBeforeBot: 2,
  botTakesOverAfterMs: 60_000,
  keepEmptyRoomMs: 60_000,
  allowBots: false,
}

/** The game's settings (e.g. content/rooms.json) on top of the defaults. Notes like "_help" are ignored. */
export function readSettings(fromGame: Partial<RoomSettings> & Record<string, unknown> = {}): RoomSettings {
  const settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof RoomSettings)[]) {
    const value = fromGame[key]
    if (typeof value === typeof DEFAULT_SETTINGS[key]) (settings as Record<string, unknown>)[key] = value
  }
  if (settings.minSeats < 1) settings.minSeats = 1
  if (settings.maxSeats < settings.minSeats) settings.maxSeats = settings.minSeats
  return settings
}
