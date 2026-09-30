// Glyphtender's Dev Kit adapter: a snapshot round-trips through the store, and turns show up as events.
import { beforeEach, describe, expect, it } from 'vitest'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { useGameStore } from '../store/gameStore'
import { describeGlyphtender, glyphtenderAdapter, type GlyphtenderMoment } from './glyphtenderAdapter'

const store = () => useGameStore.getState()

/** Yellow to play: glyphling 0 at C6-7 can move up to C6-6. */
const yellowToPlay = (hand = ['B', 'C', 'D']) => position({
  glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
  hands: [hand, ['E']],
  bag: ['V', 'W', 'X'],
})

beforeEach(() => {
  store().leaveGame()
  store().setWords(wordsOf('AT', 'TA'))
})

describe('glyphtenderAdapter', () => {
  it('names the game and its version (from version.json)', () => {
    expect(glyphtenderAdapter.name).toBe('Glyphtender')
    expect(glyphtenderAdapter.version).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
  })

  it('a snapshot is plain JSON, and restoring it brings the game back — without the planned move', () => {
    store().loadState(yellowToPlay())
    store().moveTraySeed(0, 2)
    const saved = JSON.parse(JSON.stringify(glyphtenderAdapter.getState())) as GlyphtenderMoment
    expect(saved.trayOrder[0]).toEqual([1, 2, 0])

    // Play on: plan a move, then load something else
    store().grabGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    expect(store().move).not.toBeNull()
    store().startGame({ players: 3, seed: 99 })

    glyphtenderAdapter.setState(saved)
    expect(store().game).toEqual(saved.game)
    expect(store().trayOrder).toEqual(saved.trayOrder)
    expect(store().move).toBeNull()
    expect(store().flying).toBe(false)
  })

  it('restoring the main menu leaves the game; junk is refused with a plain reason', () => {
    store().loadState(yellowToPlay())
    glyphtenderAdapter.setState({ game: null, trayOrder: [] })
    expect(store().game).toBeNull()
    expect(() => glyphtenderAdapter.setState({ hello: 1 })).toThrow(/isn't a Glyphtender snapshot/)
  })

  it('sends a line for a new game, each draft placement, and each turn', () => {
    const lines: string[] = []
    const stop = glyphtenderAdapter.onEvent!((text) => lines.push(text))
    store().startGame({ players: 2, seed: 7 })
    expect(lines.at(-1)).toMatch(/^game started: 2 players · .* seed 7/)

    store().loadState(yellowToPlay([])) // no seeds in hand
    store().grabGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().startCast() // a move only (nothing cast) commits at once
    expect(lines.some((l) => /^Yellow moved glyphling 0 C6-7 → C6-6, move only/.test(l))).toBe(true)

    stop()
    const count = lines.length
    store().leaveGame()
    expect(lines).toHaveLength(count) // stopped listening
  })

  it('describes a moment in one line', () => {
    expect(describeGlyphtender({ game: null, trayOrder: [] })).toBe('main menu')
    expect(describeGlyphtender({ game: yellowToPlay(), trayOrder: [] })).toMatch(/^turn 0 · play · Yellow to move/)
  })
})
