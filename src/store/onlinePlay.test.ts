// The store's online path against a fake room: the real server rules in memory, with messages delivered
// only when the test says so (like a network). This device is seat 0 (Yellow); the test plays seat 1 (Blue).
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { legalDraftHexes, legalMoves } from '../engine/engine'
import { randomAction } from '../engine/sim'
import { parseWordList } from '../engine/words'
import type { WordList } from '../engine/types'
import { RoomServer, type PartyConnection, type PartyRoom } from '../rooms/server/roomServer'
import type { ServerMessage } from '../rooms/protocol'
import { makeRules } from '../../party/glyphtenderRules'
import { HIDDEN, type GameView, type OnlineAction, type OnlineOptions } from '../../party/protocol'
import type { ServerGame } from '../../party/serverGame'
import settings from '../../content/rooms.json'
import animJson from '../../content/tuning/anim.json'
import { glideSeconds } from '../game/glide'
import { useGameStore } from './gameStore'
import { actionRefused, connectOnline, receiveView, stopOnline } from './onlinePlay'
import { boardHighlight, castOptions } from './turnPlan'

let words: WordList
beforeAll(() => { words = parseWordList(readFileSync('public/words/words.csv', 'utf8')) })

const store = () => useGameStore.getState()

/** A fake connection: what the server sends waits in `mail` until deliver(). */
class Conn implements PartyConnection {
  mail: ServerMessage[] = []
  seen: GameView[] = []
  id: string
  constructor(id: string) { this.id = id }
  send(text: string) { this.mail.push(JSON.parse(text)) }
  close() {}
}

let server: RoomServer<ServerGame, OnlineOptions, OnlineAction, GameView, never>
let me: Conn, blue: Conn
let sent: OnlineAction[] = []

/** Hands the mail over: my views go to the store (and refusals to actionRefused); Blue's are kept for the test. */
function deliver() {
  for (const message of me.mail.splice(0)) {
    if (message.type === 'view' && message.view) receiveView(message.view as GameView)
    if (message.type === 'error' && message.code === 'action_refused') actionRefused()
  }
  for (const message of blue.mail.splice(0)) if (message.type === 'view' && message.view) blue.seen.push(message.view as GameView)
}
const blueView = () => blue.seen.at(-1)!
const toServer = (conn: Conn, message: unknown) => server.onMessage(JSON.stringify(message), conn)

/** Blue plays one random legal action from its own view. */
function bluePlays(seed = 1) {
  deliver()
  const view = blueView()
  const pick = randomAction(view.game, seed)
  toServer(blue, { type: 'action', action: { kind: 'play', action: pick.action, version: view.version } })
}

/** Yellow (this device) plans a random legal turn through the store, casting if it can, and presses Cast. */
function yellowPlansAndCasts(seed = 1) {
  const game = store().game!
  const pick = randomAction(game, seed).action
  if (pick.type !== 'turn') throw new Error('expected a turn')
  store().tapGlyphling(pick.glyphling)
  store().tapHex(pick.to)
  const targets = castOptions(game, { glyphling: pick.glyphling, to: pick.to })
  if (game.hands[0].length > 0 && targets.length > 0) {
    store().tapSeed(0)
    store().tapHex(targets[0])
  }
  store().startCast()
}

beforeEach(() => {
  vi.useFakeTimers()
  store().leaveGame()
  stopOnline()
  store().setWords(words)
  let n = 42
  server = new RoomServer({ id: 'BAKU', getConnection: () => undefined } as PartyRoom, makeRules({ words: () => words, randomSeed: () => (n = (n * 48271) % 2147483647) }), settings)
  server.log = () => {}
  me = new Conn('me')
  blue = new Conn('blue')
  sent = []
  connectOnline((message) => {
    sent.push(message)
    toServer(me, { type: 'action', action: message })
    return true
  })
  toServer(me, { type: 'join', name: 'Ada', persistentId: 'persistent-me', create: true })
  toServer(blue, { type: 'join', name: 'Bo', persistentId: 'persistent-blue', create: false })
  toServer(blue, { type: 'ready', ready: true })
  toServer(me, { type: 'start', options: {} })
  deliver()
})
afterEach(() => vi.useRealTimers())

/** Both players place their glyphlings (Yellow through the store's taps). */
function finishDraft() {
  while (store().game!.phase === 'draft') {
    if (store().game!.current === 0) store().tapHex(legalDraftHexes(store().game!)[0])
    else bluePlays()
    deliver()
  }
}

describe('online store — starting and the draft', () => {
  it('the first view starts the game: my seat is local, the others online, no handoff', () => {
    expect(store().game?.phase).toBe('draft')
    expect(store().online?.mySeat).toBe(0)
    expect(store().seats.map((s) => [s.kind, s.name])).toEqual([['local', 'Ada'], ['online', 'Bo']])
    expect(store().options?.hideSeeds).toBe(false)
    expect(store().options?.wordIndicators).toBe(true) // the host's lobby option (on unless turned off)
  })

  it('my placement goes to the server and nothing can be touched until its view comes back', () => {
    store().tapHex(legalDraftHexes(store().game!)[0])
    expect(store().waiting).toBe(true)
    expect(store().game!.glyphlings).toHaveLength(0) // not applied locally
    expect(sent.at(-1)).toMatchObject({ kind: 'play', action: { type: 'draft' }, version: 0 })
    deliver()
    expect(store().waiting).toBe(false)
    expect(store().game!.glyphlings).toHaveLength(1)
    expect(store().online!.version).toBe(1)
  })

  it('after the draft: my seeds are real, Blue\'s are "?", and no handoff screen', () => {
    finishDraft()
    const game = store().game!
    expect(game.phase).toBe('play')
    expect(game.hands[0].every((s) => s !== HIDDEN)).toBe(true)
    expect(game.hands[1].every((s) => s === HIDDEN)).toBe(true)
    expect(store().handoff).toBeNull()
    expect(store().trayOrder[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('online store — turns', () => {
  it('my Cast: the action leaves at once, the view waits for the seed to land, then it sprouts', () => {
    finishDraft()
    yellowPlansAndCasts()
    expect(store().flying).toBe(true)
    expect(sent.at(-1)).toMatchObject({ kind: 'play', action: { type: 'turn' } })
    deliver() // the server's answer arrives mid-throw
    expect(store().online!.version).toBe(4) // not shown yet
    const landedBefore = store().landed?.count ?? 0
    store().finishCast() // the seed lands
    expect(store().online!.version).toBe(5)
    expect(store().flying).toBe(false)
    expect(store().landed!.count).toBe(landedBefore + 1)
    expect(store().trayOrder[0]).toHaveLength(store().game!.hands[0].length)
  })

  it('my seed lands before the answer: it waits, asks again after 3 s, and shows it when it comes', () => {
    finishDraft()
    yellowPlansAndCasts()
    me.mail = [] // the answer got lost
    store().finishCast()
    expect(store().waiting).toBe(true)
    expect(boardHighlight({ ...store(), game: store().game! })).toBeNull() // my move is at the server: no more gold
    vi.advanceTimersByTime(3000)
    expect(sent.at(-1)).toEqual({ kind: 'sync' })
    deliver()
    expect(store().waiting).toBe(false)
    expect(store().online!.version).toBeGreaterThan(4)
  })

  it("Blue's turn is replayed on the old view: glide, then the throw, then the new view", () => {
    finishDraft()
    yellowPlansAndCasts()
    deliver()
    store().finishCast()
    if (store().game!.phase === 'refresh') { store().refresh(true); deliver() }
    const before = store().game!
    expect(before.current).toBe(1)
    bluePlays(7)
    deliver()
    const turn = blueView().game.lastTurn!
    expect(store().game!.glyphlings).toEqual(before.glyphlings) // still the old view…
    expect(store().move).toEqual({ glyphling: turn.glyphlingId, to: turn.to }) // …with Blue's glyphling gliding
    expect(boardHighlight({ ...store(), game: store().game! })).toBeNull() // no gold on my screen for Blue's move
    vi.advanceTimersByTime(glideSeconds(turn.from, turn.to, animJson) * 1000)
    if (turn.letter) {
      expect(store().flying).toBe(true)
      expect(store().game!.hands[1][0]).toBe(turn.letter) // the seed in the air is public now
      store().finishCast()
    }
    expect(store().online!.version).toBe(blueView().version)
    expect(store().game!.hands[1].every((s) => s === HIDDEN)).toBe(true)
    expect(store().move).toBeNull()
  })

  it('a sync answered with the same version means my action was lost: the plan comes back to play again', () => {
    finishDraft()
    yellowPlansAndCasts()
    server.game = { ...server.game!, version: server.game!.version - 1 } // (pretend the server never got it)
    me.mail = []
    store().finishCast()
    vi.advanceTimersByTime(3000)
    server.game = { ...server.game!, version: store().online!.version }
    deliver()
    expect(store().waiting).toBe(false)
    expect(store().note).toBe('problem')
  })

  it('a refused action drops the plan, says "problem" and asks for the true view', () => {
    finishDraft()
    const glyphling = store().game!.glyphlings.find((g) => g.seat === 0)!
    store().tapGlyphling(glyphling.id)
    store().tapHex(legalMoves(store().game!, glyphling.id)[0])
    actionRefused()
    expect(store().move).toBeNull()
    expect(store().note).toBe('problem')
    expect(sent.at(-1)).toEqual({ kind: 'sync' })
  })

  it('a whole game to the end: the reveal gets the full truth and the end table', () => {
    finishDraft()
    for (let i = 0; i < 3000 && store().game!.phase !== 'over'; i++) {
      const game = store().game!
      if (store().flying) store().finishCast()
      else if (game.current === 0 && game.phase === 'refresh') store().refresh(true)
      else if (game.current === 0 && !store().waiting) yellowPlansAndCasts(i + 1)
      else if (game.current === 1 && !store().move) bluePlays(i + 1)
      deliver()
      vi.advanceTimersByTime(1000)
    }
    const game = store().game!
    expect(game.phase).toBe('over')
    expect(game).toEqual(server.game!.game)
    expect(store().stats).toEqual(server.game!.stats)
    expect(game.magic.some((m) => m > 0)).toBe(true)
  })

  it('a rematch (a new game id) starts over from its first view', () => {
    finishDraft()
    const firstId = store().online!.gameId
    receiveView({ ...blueView(), gameId: firstId + 1, version: 0, mySeat: 0 })
    expect(store().online!.gameId).toBe(firstId + 1)
    expect(store().online!.version).toBe(0)
  })
})
