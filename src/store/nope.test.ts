// Which taps are refused with a "no" shake.
import { beforeEach, describe, expect, it } from 'vitest'
import { getBoard } from '../engine/boards'
import { DIRECTIONS, addHex, hexKey } from '../engine/hex'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { useGameStore } from './gameStore'
import { nopeFor, type Tap } from './nope'

const store = () => useGameStore.getState()
const nope = (tap: Tap) => nopeFor(store(), tap)

/** Seeds on every hex next to `label` (a glyphling there is tangled). */
function boxIn(label: string): Record<string, string> {
  const board = getBoard('small')
  return Object.fromEntries(DIRECTIONS.map((d) => addHex(hexAt(label), d)).filter(board.has).map((h) => [board.label(h), 'A']))
}

/** Yellow to play: glyphling 0 free, glyphling 1 tangled in the corner; Blue's are 2 and 3. */
function yellowToPlay() {
  store().loadState(position({
    glyphlings: { 0: 'C6-7', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' },
    seeds: [boxIn('C1-1')], hands: [['T', 'E'], ['E']], bag: ['X'],
  }))
}

beforeEach(() => {
  store().leaveGame()
  store().setWords(wordsOf('AT'))
})

describe('the "no" shake', () => {
  it('my free glyphling is fine; another player’s, or my tangled one, shakes', () => {
    yellowToPlay()
    expect(nope({ glyph: 0 })).toBeNull()
    expect(nope({ glyph: 2 })).toEqual({ kind: 'glyph', key: '2' })
    expect(nope({ glyph: 1 })).toEqual({ kind: 'glyph', key: '1' })
  })

  it('a planted seed shakes; an empty hex doesn’t', () => {
    yellowToPlay()
    expect(nope({ hex: hexAt('C1-2') })).toEqual({ kind: 'seed', key: hexKey(hexAt('C1-2')) })
    expect(nope({ hex: hexAt('C6-5') })).toBeNull()
  })

  it('a tray seed tapped or dragged before I’ve moved shakes (B008: no reordering before the move); after the move it’s fine', () => {
    yellowToPlay()
    expect(nope({ hand: 1 })).toEqual({ kind: 'hand', key: '1' })
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    expect(nope({ hand: 1 })).toBeNull()
  })

  it('the store shakes the piece: a new "no" each time, even on the same piece', () => {
    yellowToPlay()
    expect(store().refuseTap({ glyph: 2 })).toBe(true)
    expect(store().nope).toMatchObject({ kind: 'glyph', key: '2', count: 1 })
    store().refuseTap({ glyph: 2 })
    expect(store().nope?.count).toBe(2)
    expect(store().refuseTap({ glyph: 0 })).toBe(false)
    expect(store().nope?.count).toBe(2) // an allowed tap changes nothing
  })

  it('online, not my turn: my own glyphling and tray seeds shake too', () => {
    yellowToPlay()
    useGameStore.setState({ seats: [{ kind: 'online', name: 'Bo', colour: 'yellow' }, { kind: 'local', name: 'Me', colour: 'blue' }] })
    expect(nope({ glyph: 2 })).toEqual({ kind: 'glyph', key: '2' })
    expect(nope({ hand: 0 })).toEqual({ kind: 'hand', key: '0' })
  })

  it('quiet moments shake nothing: a seed in the air, the device being passed on, the game over', () => {
    yellowToPlay()
    useGameStore.setState({ flying: true })
    expect(nope({ glyph: 2 })).toBeNull()
    useGameStore.setState({ flying: false, handoff: { seat: 0, afterGrow: false } })
    expect(nope({ glyph: 2 })).toBeNull()
    useGameStore.setState({ handoff: null, game: { ...store().game!, phase: 'over' } })
    expect(nope({ hex: hexAt('C1-2') })).toBeNull()
  })
})
