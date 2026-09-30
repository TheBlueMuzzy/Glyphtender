// THE TURN CLOCK — after every change: whose turn is it, and does the server have to play it?
//   · a bot has the seat (the player left, idled, or stayed away past botTakesOverAfterMs) → the server
//     plays the turn after botTurnDelayMs, so the others can watch it happen
//   · the host turned the timer on → the turn (incl. its refresh) must be played in time; if not, the server
//     plays a legal turn for them and the rooms module counts a missed turn (2 in a row → a bot takes the seat)
// Turns the server plays: the engine's greedy sim player (a real move + cast, never a pass) and "keep all"
// on a refresh. Beta swaps in a real AI personality here (design/online.md §6).
import roomsJson from '../content/rooms.json'
import type { RoomTools } from '../src/rooms/server/gameRules'
import { greedyAction } from '../src/engine/sim'
import type { WordList } from '../src/engine/types'
import { play, type ServerGame } from './serverGame'

const TURN_TIMER = 'turn'
const BOT_TIMER = 'bot'

/** Starts (or stops) the timers for whoever plays next, and says when their turn runs out. */
export function planNextTurn(state: ServerGame, room: RoomTools<ServerGame, never>, words: () => WordList): ServerGame {
  const { game } = state
  room.timers.stop(BOT_TIMER)
  if (game.phase === 'over') {
    room.timers.stop(TURN_TIMER)
    return { ...state, turnEndsAt: null }
  }
  const seatId = state.seatIds[game.current]
  const seat = room.seats().find((s) => s.id === seatId)
  if (!seat || seat.kind === 'bot') {
    room.timers.stop(TURN_TIMER)
    room.timers.start(BOT_TIMER, roomsJson.botTurnDelayMs, () => room.update((now) => autoPlay(now, room, words)))
    return { ...state, turnEndsAt: null }
  }
  if (state.options.turnSeconds <= 0) return { ...state, turnEndsAt: null }
  // The refresh after a turn is still the same turn: its clock keeps running
  if (game.phase === 'refresh' && room.timers.isRunning(TURN_TIMER)) return state
  const ms = state.options.turnSeconds * 1000
  room.timers.start(TURN_TIMER, ms, () => {
    room.update((now) => autoPlay(now, room, words))
    room.missedTurn(seatId)
  })
  return { ...state, turnEndsAt: Date.now() + ms }
}

/** The server plays the whole turn for the current seat (move + cast, then "keep all" if it may refresh). */
export function autoPlay(state: ServerGame, room: RoomTools<ServerGame, never>, words: () => WordList): ServerGame {
  const seat = state.game.current
  let next = state
  if (next.game.phase !== 'refresh') {
    const picked = greedyAction(next.game, next.botRng, words())
    next = { ...play(next, seat, picked.action, words()), botRng: picked.rng }
  }
  if (next.game.phase === 'refresh' && next.game.current === seat) next = play(next, seat, { type: 'refresh', setAside: [] }, words())
  room.log(`the server played a turn for seat ${seat}`)
  return planNextTurn(next, room, words)
}
