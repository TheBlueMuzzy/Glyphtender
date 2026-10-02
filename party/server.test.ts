// The online server with a fake PartyKit (no live server): whole games played through the real rooms module
// and Glyphtender's rules plug-in. Each fake player plays ONLY from the views it was sent — and after every
// message we check that no view ever held another player's seeds, the bag, the rng, the seed or any Magic
// before the game was over (design/online.md §10).
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { newGame } from '../src/engine/engine'
import { randomAction } from '../src/engine/sim'
import { parseWordList } from '../src/engine/words'
import type { WordList } from '../src/engine/types'
import { RoomServer, type PartyConnection, type PartyRoom } from '../src/rooms/server/roomServer'
import type { ServerMessage } from '../src/rooms/protocol'
import settings from '../content/rooms.json'
import { makeRules } from './glyphtenderRules'
import { HIDDEN, type GameView, type OnlineAction, type OnlineOptions } from './protocol'
import type { ServerGame } from './serverGame'

let words: WordList
beforeAll(() => { words = parseWordList(readFileSync('public/words/words.csv', 'utf8')) })
afterEach(() => vi.useRealTimers())

// ─── A fake PartyKit ────────────────────────────────────────────────
class FakeParty implements PartyRoom {
  id = 'BAKU'
  live = new Map<string, FakeConnection>()
  getConnection(id: string) { return this.live.get(id) }
}
class FakeConnection implements PartyConnection {
  received: ServerMessage[] = []
  id: string
  constructor(id: string) { this.id = id }
  send(text: string) { this.received.push(JSON.parse(text)) }
  close() {}
  views() { return this.received.filter((m) => m.type === 'view' && m.view).map((m) => (m as { view: GameView }).view) }
  lastView() { return this.views().at(-1) }
  errors() { return this.received.filter((m) => m.type === 'error') }
}

type Server = RoomServer<ServerGame, OnlineOptions, OnlineAction, GameView, never>

/** A room with `players` joined (the first is host), started with `options`. */
function startRoom(players: number, options: Partial<OnlineOptions> = {}, seed: number | 'secret' = 7) {
  let n = seed === 'secret' ? 0 : seed
  const randomSeed = seed === 'secret' ? undefined : () => (n = (n * 48271) % 2147483647) // 'secret' = the real server’s random numbers
  const rules = makeRules({ words: () => words, randomSeed })
  const party = new FakeParty()
  // (no flood limit here: a whole game is played within one real second)
  const server: Server = new RoomServer(party, rules, { ...settings, botTakesOverAfterMs: 0, maxMessagesPerSecond: 0 })
  server.log = () => {} // quiet tests
  const conns = Array.from({ length: players }, (_, i) => {
    const conn = new FakeConnection(`tab-${i}`)
    party.live.set(conn.id, conn)
    server.onConnect(conn)
    server.onMessage(JSON.stringify({ type: 'join', name: `P${i}`, persistentId: `player-id-${i}`, create: i === 0 }), conn)
    return conn
  })
  conns.slice(1).forEach((conn) => server.onMessage(JSON.stringify({ type: 'ready', ready: true }), conn))
  server.onMessage(JSON.stringify({ type: 'start', options }), conns[0])
  return { server, conns }
}

const send = (server: Server, conn: FakeConnection, action: unknown) =>
  server.onMessage(JSON.stringify({ type: 'action', action }), conn)

/** Fails if this view (seen by its own seat) holds anything secret. */
function expectNoSecrets(view: GameView) {
  const { game, mySeat } = view
  if (game.phase === 'over') return
  game.hands.forEach((hand, seat) => { if (seat !== mySeat) expect(hand.every((s) => s === HIDDEN)).toBe(true) })
  expect(game.bag.every((s) => s === HIDDEN)).toBe(true)
  expect(game.rng).toBe(0)
  expect(game.config.seed).toBe(0)
  expect([...game.magic, ...game.tangleMagic].every((m) => m === 0)).toBe(true)
  expect(game.winners).toEqual([])
  expect(game.lastTurn?.magic ?? 0).toBe(0)
  expect(game.lastTurn?.words.every((w) => w.magic === 0) ?? true).toBe(true)
  expect(view.results).toBeNull()
  // the game log holds every turn's Magic and the running totals: sent empty until the end (D47)
  expect(game.log ?? { turns: [], end: null }).toEqual({ turns: [], end: null })
  // …and what a rival could have spelled with their hand on a cast's hex (Weed toss): log-only, never sent before the end
  expect(game.pendingLog ?? null).toBeNull()
  expect(JSON.stringify(view)).not.toMatch(/totalsAfter|ownMagic|"tangles"|"blocked"|"mobility"/)
}

/** Every player plays random legal moves from their OWN view until the game ends. */
function playOut(server: Server, conns: FakeConnection[], rngStart: number) {
  let rng = rngStart
  for (let step = 0; step < 3000; step++) {
    const view = conns[0].lastView()!
    if (view.game.phase === 'over') return step
    const mine = conns[view.game.current].lastView()!
    const pick = randomAction(mine.game, rng)
    rng = pick.rng
    send(server, conns[view.game.current], { kind: 'play', action: pick.action, version: mine.version })
  }
  throw new Error('the game never ended')
}

describe('online server — secrets stay secret', () => {
  for (const [players, seed] of [[2, 3], [2, 11], [3, 5], [4, 9]]) {
    it(`${players} players, game ${seed}: no view ever holds another hand, the bag, the rng or Magic before the end`, () => {
      const { server, conns } = startRoom(players, {}, seed)
      playOut(server, conns, seed)
      for (const conn of conns) {
        expect(conn.errors()).toEqual([])
        const views = conn.views()
        views.forEach(expectNoSecrets)
        // At the end: the whole truth + the end table, the same for everyone
        const last = views.at(-1)!
        expect(last.game.phase).toBe('over')
        expect(last.game).toEqual(server.game!.game)
        expect(last.results?.stats).toEqual(server.game!.stats)
        expect(last.game.winners.length).toBeGreaterThan(0)
        // …and the whole game log, for the end screen
        expect(last.game.log!.turns).toHaveLength(server.game!.game.turnCount)
        expect(last.game.log!.end?.totals).toEqual(server.game!.game.magic)
      }
      // Some Magic really was made (so the zeroing above was hiding something real)
      expect(server.game!.game.magic.some((m) => m > 0)).toBe(true)
    })
  }

  it('each player gets their OWN view: their seeds, the others as "?"', () => {
    const { server, conns } = startRoom(2)
    playOut(server, conns.slice(), 1) // (plays to the end) — look at the first view after the deal
    const dealt = conns[1].views().find((v) => v.game.phase === 'play')!
    expect(dealt.mySeat).toBe(1)
    expect(dealt.game.hands[1].some((s) => s !== HIDDEN)).toBe(true)
    expect(dealt.game.hands[0]).toEqual(Array(8).fill(HIDDEN))
    expect(dealt.names).toEqual(['P0', 'P1'])
  })
})

describe('online server — the bag can’t be worked out', () => {
  it('the bag is not the shuffle of the game’s seed (a PC tries all 2^31 seeds against its own hand in ~30 min)', () => {
    const { server } = startRoom(2)
    const { game } = server.game!
    expect(game.bag).not.toEqual(newGame({ players: 2, seed: game.config.seed }).bag)
  })

  it('the real server’s random numbers are secret ones, not Math.random (its next numbers can be worked out from earlier ones)', () => {
    const mathRandom = vi.spyOn(Math, 'random')
    const { server } = startRoom(2, {}, 'secret')
    expect(server.game).not.toBeNull()
    expect(mathRandom).not.toHaveBeenCalled()
    mathRandom.mockRestore()
  })
})

describe('online server — says no, and changes nothing', () => {
  function afterDraft() {
    const { server, conns } = startRoom(2)
    let rng = 1
    while (conns[0].lastView()!.game.phase === 'draft') {
      const view = conns[conns[0].lastView()!.game.current].lastView()!
      const pick = randomAction(view.game, rng)
      rng = pick.rng
      send(server, conns[view.game.current], { kind: 'play', action: pick.action, version: view.version })
    }
    return { server, conns }
  }
  const refused = (conn: FakeConnection) => conn.errors().at(-1) as { code: string; message: string } | undefined

  it('the wrong player, an old version, a bad shape, an illegal move', () => {
    const { server, conns } = afterDraft()
    const before = JSON.stringify(server.game)
    const view = conns[0].lastView()!
    const legal = randomAction(view.game, 5).action
    send(server, conns[1], { kind: 'play', action: legal, version: view.version })
    expect(refused(conns[1])?.message).toMatch(/not your turn/)
    send(server, conns[0], { kind: 'play', action: legal, version: view.version - 1 })
    expect(refused(conns[0])?.message).toMatch(/moved on/)
    send(server, conns[0], { kind: 'play', action: { type: 'turn', glyphling: 'x' }, version: view.version })
    expect(refused(conns[0])?.code).toBe('bad_action')
    send(server, conns[0], { kind: 'play', action: { type: 'turn', glyphling: 2, to: { q: 0, r: 0 }, seed: null, target: null }, version: view.version })
    expect(refused(conns[0])?.message).toMatch(/another player/)
    send(server, conns[0], { kind: 'play', action: { type: 'refresh', setAside: [1, 1] }, version: view.version })
    expect(refused(conns[0])?.code).toBe('bad_action')
    expect(JSON.stringify(server.game)).toBe(before)
  })

  it('sync sends MY view again (only mine) without changing the game', () => {
    const { server, conns } = afterDraft()
    const before = conns[1].views().length
    const others = conns[0].received.length
    const version = server.game!.version
    send(server, conns[1], { kind: 'sync' })
    expect(conns[1].views().length).toBe(before + 1)
    expect(conns[0].received.length).toBe(others) // one player can't make the server message everyone
    expect(server.game!.version).toBe(version)
  })

  it('bad options are refused at the start', () => {
    const { server } = startRoom(2, { boardName: 'huge' } as Partial<OnlineOptions>)
    expect(server.game).toBeNull()
    const { server: ok } = startRoom(2, { boardName: 'large', minWordLength: 3 })
    expect(ok.game!.game.config.boardName).toBe('large')
    expect(ok.game!.game.config.rules.minWordLength).toBe(3)
    const { server: timer } = startRoom(2, { turnSeconds: 45 })
    expect(timer.game).toBeNull()
    const { server: yes } = startRoom(2, { wordIndicators: 'yes' } as unknown as Partial<OnlineOptions>)
    expect(yes.game).toBeNull()
  })

  it('word indicators: on unless the host turns them off, and every player’s view carries the choice', () => {
    const { conns } = startRoom(2)
    expect(conns.map((c) => c.lastView()!.options.wordIndicators)).toEqual([true, true])
    const { conns: off } = startRoom(2, { wordIndicators: false })
    expect(off.map((c) => c.lastView()!.options.wordIndicators)).toEqual([false, false])
  })
})

describe('online server — the turn timer and idle players', () => {
  it('timer off (the default): nobody is hurried', () => {
    vi.useFakeTimers()
    const { server } = startRoom(2)
    vi.advanceTimersByTime(10 * 60_000)
    expect(server.game!.version).toBe(0)
    expect(server.game!.turnEndsAt).toBeNull()
  })

  it('timer on: when it runs out the server plays a legal move, and after 2 in a row a bot takes the seat', () => {
    vi.useFakeTimers()
    const { server, conns } = startRoom(2, { turnSeconds: 60 })
    expect(conns[0].lastView()!.turnEndsAt).toBeGreaterThan(Date.now())
    vi.advanceTimersByTime(60_000) // Yellow's first draft placement ran out
    expect(server.game!.version).toBe(1)
    expect(server.data.seats[0].missedTurns).toBe(1)
    vi.advanceTimersByTime(60_000) // Blue's
    vi.advanceTimersByTime(60_000) // Blue's again (snake draft)
    expect(server.data.seats[1].kind).toBe('bot')
    // A bot plays at once (after botTurnDelayMs), without waiting for a timer
    vi.advanceTimersByTime(60_000 + settings.botTurnDelayMs * 10)
    expect(server.game!.version).toBeGreaterThan(4)
    conns.forEach((conn) => conn.views().forEach(expectNoSecrets))
  })

  it('dropping out and coming back doesn’t start the turn clock again — for them or for anyone else', () => {
    vi.useFakeTimers()
    const { server, conns } = startRoom(2, { turnSeconds: 60 })
    vi.advanceTimersByTime(50_000) // Yellow's first placement: 10 s left
    conns.forEach((conn, i) => { // Yellow's tab drops and comes straight back; then Blue's does too
      server.onClose(conn)
      server.onMessage(JSON.stringify({ type: 'join', name: `P${i}`, persistentId: `player-id-${i}`, create: false }), new FakeConnection(`tab-${i}-again`))
    })
    vi.advanceTimersByTime(10_000)
    expect(server.game!.version).toBe(1) // her 60 s ran out: the server placed for her
    expect(server.data.seats[0].missedTurns).toBe(1)
  })

  it('a player who leaves mid-game is played by a bot, so the others can finish', () => {
    vi.useFakeTimers()
    const { server, conns } = startRoom(2)
    server.onMessage(JSON.stringify({ type: 'leave' }), conns[1])
    let rng = 3
    for (let i = 0; i < 2000 && server.game!.game.phase !== 'over'; i++) {
      const view = conns[0].lastView()!
      if (view.game.current === 0) {
        const pick = randomAction(view.game, rng)
        rng = pick.rng
        send(server, conns[0], { kind: 'play', action: pick.action, version: view.version })
      } else vi.advanceTimersByTime(settings.botTurnDelayMs)
    }
    expect(server.game!.game.phase).toBe('over')
    conns[0].views().forEach(expectNoSecrets)
  })
})
