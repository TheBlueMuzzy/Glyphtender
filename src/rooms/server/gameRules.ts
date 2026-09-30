// GAME RULES — what a game plugs into its room server. This file is the whole contract.  (Server.)
//
// The room server runs rooms (seats, host, joining, rejoining, bots taking over idle seats).
// The game only says how ITS game works:
//   start a game → check a move → apply it → what each player may see → is it over?
// The game state lives on the server. After every change each connected player is sent
// viewFor(state, theirSeat) — so hidden things (hands, bags, scores) stay hidden in the data,
// not just on screen.
import type { Seat } from '../protocol'
import type { RoomSettings } from './settings'
import type { Timers } from './timers'

/** Why a seat changed mid-game (for onSeatChange). */
export type SeatChange =
  | 'dropped' // the player's connection dropped — their seat waits for them
  | 'back' // the player is back (reconnected, or took their seat back from a bot)
  | 'bot' // a bot plays this seat now (the player left, was kicked, idled or stayed away too long)

/** What the room server hands to the game's rules. */
export interface RoomTools<State, Event> {
  /** The room code. */
  readonly code: string
  readonly settings: RoomSettings
  /** The room's one timers table — use it for turn clocks and hard time limits. */
  readonly timers: Timers
  /** Every seat, in seat order. */
  seats(): Seat[]
  /**
   * Change the game state from OUTSIDE onAction (a timer ran out, a bot's move). Everyone gets their
   * new view. Ignored if no game is on. Don't call it inside onStart/onAction/onSeatChange — return the state there.
   */
  update(change: (state: State) => State): void
  /** Tell one seat something (e.g. an animation cue). Sent before the views of the same change. */
  sendEvent(seatId: string, event: Event): void
  /** Tell every connected player something (except one seat, if given). */
  broadcastEvent(event: Event, exceptSeatId?: string): void
  /** The server just played a turn for an idle player. After settings.missedTurnsBeforeBot in a row, a bot takes the seat. */
  missedTurn(seatId: string): void
  /** A line in the server log (npm run party:dev shows it), marked with the room code. */
  log(message: string): void
}

/**
 * The game's side of the room server.
 * - Every function that says no THROWS an Error with a plain-English reason — the player is told
 *   the reason and the room carries on. (Glyphtender's engine already throws like this.)
 * - Types: State = the full game (server only) · Options = the host's new-game choices ·
 *   Action = one player move · View = what one player sees · Event = one-off messages.
 */
export interface GameRules<State, Options, Action, View, Event = never> {
  /** Raw new-game options from the host → Options, or throw. (Use the helpers in checks.ts.) */
  checkOptions(raw: unknown): Options
  /** Raw action from a player → Action, or throw. Runs before onAction, on every action. */
  checkAction(raw: unknown): Action
  /** Make a new game for these seats (in seat order). Shared random setup (bags, seeds, goals) is made HERE, on the server. */
  onStart(options: Options, seats: Seat[], room: RoomTools<State, Event>): State
  /**
   * A player's move → the new state. Throw to refuse it. `seat` is who sent it (never trust an id inside the action).
   * Return the SAME state object when nothing changed (e.g. "send me my view again"): then only the sender gets their view.
   */
  onAction(state: State, seat: Seat, action: Action, room: RoomTools<State, Event>): State
  /** What this seat may see. Leave out anything that's secret from them. */
  viewFor(state: State, seat: Seat): View
  /** Is the game finished? (The room then goes to "over": rematch or back to the lobby.) */
  isOver(state: State): boolean
  /** Optional: a seat changed mid-game (see SeatChange) → the new state. E.g. start a bot's turn. */
  onSeatChange?(state: State, seat: Seat, change: SeatChange, room: RoomTools<State, Event>): State
}
