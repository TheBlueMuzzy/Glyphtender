import { beforeEach, describe, expect, it } from 'vitest'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { hexKey } from '../engine/hex'
import { legalDraftHexes } from '../engine/engine'
import { useGameStore } from './gameStore'
import { moveInOrder, reconcileOrder, shuffled } from './turnPlan'

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
    expect(store().trayOrder[0]).toEqual([0, 1, 2, 3, 4, 5, 6]) // one seed cast, none drawn yet
    store().tapSeed(1)
    store().tapSeed(3)
    store().tapSeed(1) // tap again: keep it after all
    expect(store().setAside).toEqual([3])
    store().refresh()
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
    store().finishCast() // B cast: K is now hand index 6, still shown first
    expect(store().trayOrder[0]).toEqual([6, 0, 1, 2, 3, 4, 5])
    expect(store().game?.hands[0][store().trayOrder[0][0]]).toBe('K')
  })
})

describe('tray order helpers', () => {
  it('reconcileOrder keeps survivors in place and adds new seeds at the end', () => {
    expect(reconcileOrder([3, 0, 1, 2], [0], 4)).toEqual([2, 0, 1, 3])
    expect(reconcileOrder([0, 1, 2, 3, 4], [1, 3], 5)).toEqual([0, 1, 2, 3, 4])
    expect(reconcileOrder([4, 3, 2, 1, 0], [1, 3], 5)).toEqual([2, 1, 0, 3, 4])
  })

  it('moveInOrder moves one seed; shuffled keeps every seed', () => {
    expect(moveInOrder([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2])
    expect([...shuffled([0, 1, 2, 3, 4, 5, 6, 7])].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})
