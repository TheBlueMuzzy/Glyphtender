import { describe, expect, it } from 'vitest'
import type { RoomState, Seat } from '../../rooms/protocol'
import { seatNotices, seatStatus } from './seatStatus'

// B015: when a bot takes a seat mid-game, the other players must be told (badge on the portrait + a toast)
const seat = (id: string, name: string, part: Partial<Seat> = {}): Seat =>
  ({ id, name, kind: 'human', isHost: false, connected: true, ready: false, missedTurns: 0, ...part })
const room = (seats: Seat[], phase: RoomState['phase'] = 'playing'): RoomState => ({ code: 'BAKU', phase, seats, minSeats: 2, maxSeats: 4 })

describe('seat status (what the portrait shows)', () => {
  it('here, away (connection dropped) or bot (a bot plays the seat)', () => {
    expect(seatStatus(seat('seat-1', 'Ada'))).toBe('here')
    expect(seatStatus(seat('seat-1', 'Ada', { connected: false }))).toBe('away')
    expect(seatStatus(seat('seat-1', 'Ada', { kind: 'bot', connected: false }))).toBe('bot')
    // idle but still watching: a bot still plays for them
    expect(seatStatus(seat('seat-1', 'Ada', { kind: 'bot', connected: true }))).toBe('bot')
    expect(seatStatus(undefined)).toBeNull()
  })
})

describe('seat notices (the toasts)', () => {
  const ada = seat('seat-1', 'Ada')
  const bo = seat('seat-2', 'Bo')

  it('a bot takes a seat after the player left: "Ada left — a bot is playing for them"', () => {
    const away = room([{ ...ada, connected: false }, bo])
    const bot = room([{ ...ada, connected: false, kind: 'bot' }, bo])
    expect(seatNotices(away, bot, 'seat-2')).toEqual([{ name: 'Ada', kind: 'botLeft' }])
  })

  it('a bot takes the seat of a player who is still connected but idle', () => {
    const bot = room([{ ...ada, kind: 'bot', missedTurns: 2 }, bo])
    expect(seatNotices(room([ada, bo]), bot, 'seat-2')).toEqual([{ name: 'Ada', kind: 'botIdle' }])
  })

  it('the player takes their seat back: "Ada is back"', () => {
    const bot = room([{ ...ada, connected: false, kind: 'bot' }, bo])
    expect(seatNotices(bot, room([ada, bo]), 'seat-2')).toEqual([{ name: 'Ada', kind: 'back' }])
  })

  it('no toast for a short drop-out, my own seat, the first room after a reload, or the lobby', () => {
    expect(seatNotices(room([ada, bo]), room([{ ...ada, connected: false }, bo]), 'seat-2')).toEqual([])
    expect(seatNotices(room([{ ...ada, connected: false }, bo]), room([ada, bo]), 'seat-2')).toEqual([])
    expect(seatNotices(room([ada, bo]), room([{ ...ada, kind: 'bot' }, bo]), 'seat-1')).toEqual([])
    expect(seatNotices(null, room([{ ...ada, kind: 'bot' }, bo]), 'seat-2')).toEqual([])
    expect(seatNotices(room([ada, bo], 'lobby'), room([ada, bo, seat('seat-3', 'Bot 1', { kind: 'bot' })], 'lobby'), 'seat-2')).toEqual([])
  })
})
