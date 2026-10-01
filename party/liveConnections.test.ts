import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import settings from '../content/rooms.json'
import { parseWordList } from '../src/engine/words'
import { RoomServer, type PartyConnection } from '../src/rooms/server/roomServer'
import { makeRules } from './glyphtenderRules'
import { LiveConnections } from './liveConnections'

const replies: string[] = []
const socket = (id: string): PartyConnection => ({ id, send: (m) => replies.push(m), close: () => {} })

describe('LiveConnections', () => {
  it('a late close of the old socket keeps the new one live (phone reconnect)', () => {
    const live = new LiveConnections()
    const old = socket('tab-1')
    const fresh = socket('tab-1')
    live.opened(old)
    live.opened(fresh) // the new socket opens first…
    live.closed(old) // …then the old one's close arrives
    expect(live.get('tab-1')).toBe(fresh)
  })

  it('a real close forgets the socket', () => {
    const live = new LiveConnections()
    const s = socket('tab-1')
    live.opened(s)
    live.closed(s)
    expect(live.get('tab-1')).toBeUndefined()
  })

  it('the room keeps the seat when the old socket closes late', () => {
    const live = new LiveConnections()
    const words = parseWordList(readFileSync('public/words/words.csv', 'utf8'))
    const room = new RoomServer({ id: 'BAKU', getConnection: (id) => live.get(id) }, makeRules({ words: () => words }), settings)
    room.log = () => {}
    const old = socket('tab-1')
    const fresh = socket('tab-1')
    const join = JSON.stringify({ type: 'join', persistentId: 'player-id-1', name: 'Ada', create: true })
    live.opened(old); room.onConnect(old); room.onMessage(join, old)
    live.opened(fresh); room.onConnect(fresh); room.onMessage(join, fresh)
    live.closed(old); room.onClose(old)
    expect(room.data.seats.length, replies.join('\n')).toBe(1)
    expect(room.data.seats[0].connected).toBe(true)
  })
})
