import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { hexKey } from '../engine/hex'
import { legalDraftHexes } from '../engine/engine'
import { useGameStore } from './gameStore'
import { castOptions, dropKind, highlightFor, moveInOrder, shuffled, TRAY_GAP } from './turnPlan'

const store = () => useGameStore.getState()
const words = wordsOf('AT', 'TA')

/** Yellow to play: glyphling 0 at C6-7 (can move up to C6-6 and cast onto C6-4). */
function yellowToPlay(bag = ['V', 'W', 'X', 'Y', 'Z']) {
  store().loadState(position({
    glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
    hands: [['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K'], ['E']],
    bag,
  }))
}

beforeEach(() => {
  store().leaveGame()
  store().setWords(words)
})

describe('game store — draft', () => {
  it('a new game starts in the draft, and tapping glowing hexes places glyphlings in snake order', () => {
    store().startGame({ players: 2, seed: 7 })
    expect(store().game?.phase).toBe('draft')
    const seats: number[] = []
    for (let i = 0; i < 4; i++) {
      const game = store().game!
      seats.push(game.current)
      store().tapHex(legalDraftHexes(game)[0])
    }
    expect(seats).toEqual([0, 1, 1, 0])
    expect(store().game?.phase).toBe('play')
    expect(store().trayOrder).toEqual([[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]])
  })

  it('a tap on a hex that is not allowed changes nothing', () => {
    store().startGame({ players: 2, seed: 7 })
    const before = store().game
    store().tapHex(hexAt('C1-1')) // an edge hex
    expect(store().game).toBe(before)
  })

  it('B003: a tap or drop on a non-glowing draft hex is simply ignored (no warning, no note)', () => {
    store().startGame({ players: 2, seed: 7 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store().tapHex(hexAt('C1-1')) // an edge hex: never glows in the draft
    expect(warn).not.toHaveBeenCalled()
    expect(store().note).toBeNull()
    warn.mockRestore()
  })
})

describe('game store — planning a turn (One Cast + undo)', () => {
  it('a seed can only be picked up after a move', () => {
    yellowToPlay()
    store().tapSeed(0)
    expect(store().note).toBe('moveFirst')
    expect(store().selected).toBeNull()
  })

  it("only the current player's glyphlings can be picked up", () => {
    yellowToPlay()
    store().tapGlyphling(2)
    expect(store().note).toBe('notYours')
    store().tapGlyphling(0)
    expect(store().selected).toEqual({ kind: 'glyphling', id: 0 })
    store().tapGlyphling(0) // tap again: let go
    expect(store().selected).toBeNull()
  })

  it('move, cast, then undo takes back the cast and then the move', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    expect(store().move).toEqual({ glyphling: 0, to: hexAt('C6-6') })
    store().tapSeed(2)
    store().tapHex(hexAt('C6-4'))
    expect(store().cast).toEqual({ seed: 2, target: hexAt('C6-4') })
    store().undo()
    expect(store().cast).toBeNull()
    expect(store().move).not.toBeNull()
    store().undo()
    expect(store().move).toBeNull()
  })

  it("tapping the ghost sends the glyphling back; tapping the targeted seed sends it back to the tray", () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().tapHex(hexAt('C6-4')) // the faded seed
    expect(store().cast).toBeNull()
    expect(store().move).not.toBeNull()
    store().tapHex(hexAt('C6-7')) // the ghost
    expect(store().move).toBeNull()
  })

  it('gold cast ranges show as soon as the move is planned — before a seed is picked, while aiming, and after Undo of the cast', () => {
    yellowToPlay()
    const lit = () => { const s = store(); return highlightFor(s.game!, s.move, s.selected) }
    expect(lit()).toBeNull() // nothing held, nothing planned
    store().tapGlyphling(0)
    expect(lit()?.kind).toBe('move')
    store().tapHex(hexAt('C6-6'))
    const gold = castOptions(store().game!, store().move)
    expect(gold.length).toBeGreaterThan(0)
    expect(lit()).toEqual({ kind: 'cast', hexes: gold }) // no seed picked yet
    store().tapSeed(0)
    expect(lit()).toEqual({ kind: 'cast', hexes: gold })
    store().tapHex(hexAt('C6-4'))
    expect(lit()).toEqual({ kind: 'cast', hexes: gold }) // aimed: the other choices stay lit
    store().undo()
    expect(lit()).toEqual({ kind: 'cast', hexes: gold })
    store().tapGlyphling(0) // re-pick the moved glyphling: its move options again
    expect(lit()?.kind).toBe('move')
    store().tapGlyphling(0)
    expect(lit()).toEqual({ kind: 'cast', hexes: gold })
    store().undo()
    expect(lit()).toBeNull()
  })

  it('an empty hand: no gold after the move (there is nothing to cast — End turn)', () => {
    store().loadState(position({ glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, hands: [[], ['E']], bag: [] }))
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    expect(store().move).not.toBeNull()
    expect(highlightFor(store().game!, store().move, store().selected)).toBeNull()
  })

  it('dragging: only a legal hex under the piece is a "drop here" (teal for a move, gold for a cast); anything else, none', () => {
    yellowToPlay()
    const drop = (label: string) => { const s = store(); return dropKind({ ...s, game: s.game! }, hexAt(label)) }
    store().grabGlyphling(0)
    expect(drop('C6-6')).toBe('move')
    expect(drop('C6-7')).toBeNull() // where it stands
    expect(drop('C1-1')).toBeNull() // not in a straight line
    store().tapHex(hexAt('C6-6'))
    store().grabSeed(0)
    expect(drop('C6-4')).toBe('cast')
    expect(drop('C6-6')).toBeNull() // the glyphling's own hex
    expect(dropKind({ ...store(), game: store().game! }, undefined)).toBeNull() // over the tray, off the board
  })

  it('an aimed seed moves to another gold hex with one tap', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    const other = castOptions(store().game!, store().move).find((h) => hexKey(h) !== hexKey(hexAt('C6-4')))!
    store().tapHex(other)
    expect(store().cast).toEqual({ seed: 0, target: other })
  })

  it('with a seed aimed, tapping the ghost still sends the glyphling back (its hex is gold too, but the ghost wins)', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    expect(castOptions(store().game!, store().move).some((h) => hexKey(h) === hexKey(hexAt('C6-7')))).toBe(true) // the ghost's hex is gold
    store().tapHex(hexAt('C6-7')) // the ghost
    expect(store().move).toBeNull()
    expect(store().cast).toBeNull()
  })

  it('the game itself never changes while planning', () => {
    yellowToPlay()
    const before = store().game
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    expect(store().game).toBe(before)
  })
})

describe('game store — Cast', () => {
  it('Cast locks input while the seed flies, and the turn commits when it lands', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0) // B — makes no word
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    expect(store().flying).toBe(true)
    store().undo() // ignored in flight
    expect(store().cast).not.toBeNull()
    store().finishCast()
    const game = store().game!
    expect(store().flying).toBe(false)
    expect(game.seeds[hexKey(hexAt('C6-4'))]).toEqual({ letter: 'B', seat: 0 })
    expect(store().landed?.count).toBe(1)
    expect(store().move).toBeNull()
  })

  it('a turn with no Magic opens refresh mode; set-aside seeds refill to a full hand', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast()
    expect(store().game?.phase).toBe('refresh')
    expect(store().trayOrder[0]).toEqual([TRAY_GAP, 0, 1, 2, 3, 4, 5, 6]) // one seed cast, none drawn yet: its place stays empty
    store().tapSeed(1)
    store().tapSeed(3)
    store().tapSeed(1) // tap again: keep it after all
    expect(store().setAside).toEqual([3])
    vi.useFakeTimers()
    store().refresh()
    vi.runAllTimers() // the refresh plays out on the tray first (B011 — refreshFx.test.ts)
    vi.useRealTimers()
    expect(store().game?.phase).toBe('play')
    expect(store().game?.hands[0]).toHaveLength(8)
    expect(store().trayOrder[0]).toHaveLength(8)
    expect(store().game?.current).toBe(1)
  })

  it('Keep all refreshes with nothing set aside', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast()
    store().tapSeed(2)
    store().refresh(true)
    expect(store().game?.hands[0]).toEqual(['C', 'D', 'F', 'G', 'H', 'J', 'K', 'V'])
  })

  it('the tray keeps its own order across a turn', () => {
    yellowToPlay()
    store().moveTraySeed(7, 0) // K to the front
    expect(store().trayOrder[0]).toEqual([7, 0, 1, 2, 3, 4, 5, 6])
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast() // B cast: K is now hand index 6, still shown first; B's place stays empty
    expect(store().trayOrder[0]).toEqual([6, TRAY_GAP, 0, 1, 2, 3, 4, 5])
    expect(store().game?.hands[0][store().trayOrder[0][0]]).toBe('K')
  })
})

describe("the tray never re-sorts on a cast (Muzzy 2026-10-01: don't resort, it's confusing/jarring)", () => {
  /** Yellow's hand B C A F G H J K; a Yellow T at C6-3, so A cast onto C6-4 makes AT (Magic → draw 1). */
  function yellowCanMakeAT(bag = ['V', 'W']) {
    store().loadState(position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C6-3': 'T' }],
      hands: [['B', 'C', 'A', 'F', 'G', 'H', 'J', 'K'], ['E']],
      bag,
    }))
  }
  const castFromTray = (handIndex: number) => {
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(handIndex)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast()
  }
  const trayLetters = (seat = 0) => store().trayOrder[seat].map((i) => (i === TRAY_GAP ? '_' : store().game!.hands[seat][i]))

  it("a cast that makes Magic: the drawn seed takes the cast seed's place, no other seed moves", () => {
    yellowCanMakeAT()
    castFromTray(2) // A, third in the tray
    expect(store().game!.lastTurn?.drew).toBe(1)
    expect(trayLetters()).toEqual(['B', 'C', 'V', 'F', 'G', 'H', 'J', 'K'])
  })

  it("the player's own order is kept too: the new seed lands where the cast one was", () => {
    yellowCanMakeAT()
    store().moveTraySeed(7, 0) // K to the front: K B C A F G H J
    castFromTray(2) // A, now fourth
    expect(trayLetters()).toEqual(['K', 'B', 'C', 'V', 'F', 'G', 'H', 'J'])
  })

  it("no seed drawn (the bag is empty): the cast seed's place stays empty, nothing shifts", () => {
    yellowCanMakeAT([])
    castFromTray(2)
    expect(trayLetters()).toEqual(['B', 'C', '_', 'F', 'G', 'H', 'J', 'K'])
  })

  it('no Magic: the gap waits for the refresh, which fills it in place', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(3) // F — makes no word
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast()
    expect(trayLetters()).toEqual(['B', 'C', 'D', '_', 'G', 'H', 'J', 'K'])
    store().refresh(true) // Keep all: one new seed, into the empty place
    expect(trayLetters()).toEqual(['B', 'C', 'D', 'V', 'G', 'H', 'J', 'K'])
  })
})

describe('tray order helpers', () => {

  it('moveInOrder moves one seed; shuffled keeps every seed', () => {
    expect(moveInOrder([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2])
    expect(moveInOrder([0, TRAY_GAP, 1, 2], 3, 1)).toEqual([0, 2, 1, TRAY_GAP]) // into an empty place: nothing else moves
    expect([...shuffled([0, 1, 2, 3, 4, 5, 6, 7])].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('game store — loading an older game', () => {
  it('F24: every load (Dev Kit snapshot, e2e fixture, preview) turns the old "Qu" seed into a plain "Q"', () => {
    const game = position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      hands: [['Qu', 'A'], ['E']],
      bag: ['Qu', 'W'],
      seeds: [{ 'C6-2': 'Qu' }],
    })
    const lastTurn = { seat: 1, glyphlingId: 2, from: hexAt('C11-2'), to: hexAt('C11-1'), letter: 'Qu', target: hexAt('C6-2'), words: [], magic: 0, drew: 0 }
    const logged = {
      turnNo: 1, round: 1, seat: 1, glyphlingId: 2, from: hexAt('C11-2'), to: hexAt('C11-1'), letter: 'Qu', target: hexAt('C6-2'),
      words: [{ word: 'QUA', letters: ['Qu', 'A'], owners: [1, 0], magic: 3, ownMagic: 1 }],
      magic: 3, refreshed: 0, refresh: false, totalsAfter: [0, 3], tangledAfter: [], newlyTangled: [], freed: [],
    }
    store().loadState({ ...game, lastTurn, log: { turns: [logged], end: null } })
    const loaded = store().game!
    expect(loaded.hands[0]).toEqual(['Q', 'A'])
    expect(loaded.bag).toEqual(['Q', 'W'])
    expect(Object.values(loaded.seeds).map((s) => s.letter)).toEqual(['Q'])
    expect(loaded.lastTurn?.letter).toBe('Q')
    expect(loaded.log?.turns[0].letter).toBe('Q')
    expect(loaded.log?.turns[0].words[0].letters).toEqual(['Q', 'A'])
  })
})
