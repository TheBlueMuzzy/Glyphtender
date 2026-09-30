import { describe, expect, it } from 'vitest'
import { applyAction, checkAction } from './engine'
import { hexAt, position, wordsOf } from './testkit'
import type { GameState } from './types'

const words = wordsOf('AT')
const seedTotal = (s: GameState) => s.bag.length + s.hands.flat().length + Object.keys(s.seeds).length
/** Yellow casts a seed that makes no word, with a full hand of 8 and a 5-seed bag. */
function noMagicTurn(bag = ['V', 'W', 'X', 'Y', 'Z']): GameState {
  const s = position({
    glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
    hands: [['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K'], ['E']],
    bag,
  })
  return applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }, words)
}

describe('refresh (GDD §4.7)', () => {
  it('a turn with no Magic lets the same player refresh', () => {
    const s = noMagicTurn()
    expect(s.phase).toBe('refresh')
    expect(s.current).toBe(0)
    expect(s.hands[0]).toHaveLength(7)
    expect(s.magic).toEqual([0, 0])
  })

  it('setting nothing aside just refills the hand to 8', () => {
    const next = applyAction(noMagicTurn(), { type: 'refresh', setAside: [] }, words)
    expect(next.hands[0]).toEqual(['C', 'D', 'F', 'G', 'H', 'J', 'K', 'V'])
    expect(next.bag).toEqual(['W', 'X', 'Y', 'Z'])
    expect(next.phase).toBe('play')
    expect(next.current).toBe(1)
    expect(next.lastTurn?.drew).toBe(1)
  })

  it('set-aside seeds go back into the bag after refilling, at random places (none lost)', () => {
    const s = noMagicTurn()
    const next = applyAction(s, { type: 'refresh', setAside: [0, 2] }, words) // C and F
    expect(next.hands[0]).toEqual(['D', 'G', 'H', 'J', 'K', 'V', 'W', 'X'])
    expect([...next.bag].sort()).toEqual(['C', 'F', 'Y', 'Z'])
    expect(seedTotal(next)).toBe(seedTotal(s))
    expect(next.rng).not.toBe(s.rng) // the random places came from the game's seeded random
    expect(applyAction(s, { type: 'refresh', setAside: [0, 2] }, words)).toEqual(next) // same seed, same result
  })

  it('refills first, so you never draw your own set-aside seeds straight back', () => {
    const s = noMagicTurn(['V'])
    const next = applyAction(s, { type: 'refresh', setAside: [0, 1] }, words)
    expect(next.hands[0]).toEqual(['F', 'G', 'H', 'J', 'K', 'V']) // only 1 seed was in the bag
    expect([...next.bag].sort()).toEqual(['C', 'D'])
  })

  it('an empty bag means no refresh step — the turn just ends', () => {
    const s = noMagicTurn([])
    expect(s.phase).toBe('play')
    expect(s.current).toBe(1)
    expect(s.hands[0]).toHaveLength(7)
  })

  it('refuses bad refreshes and refuses turns while a refresh is due', () => {
    const s = noMagicTurn()
    expect(checkAction(s, { type: 'refresh', setAside: [0, 0] })).toMatch(/twice/)
    expect(checkAction(s, { type: 'refresh', setAside: [7] })).toMatch(/not in your hand/)
    expect(checkAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-5'), seed: 0, target: hexAt('C6-7') })).toMatch(/refresh/)
    const played = applyAction(s, { type: 'refresh', setAside: [] }, words)
    expect(() => applyAction(played, { type: 'refresh', setAside: [] }, words)).toThrow(/no Magic/)
  })

  it('the tangle check waits until the refresh is done', () => {
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C6-5' },
      seeds: [{ 'C10-2': 'A', 'C10-3': 'B' }, { 'C2-2': 'C', 'C2-3': 'D', 'C11-2': 'E' }],
      hands: [['S', 'Q'], ['T']],
      bag: ['R'],
    })
    const cast = applyAction(s, { type: 'turn', glyphling: 1, to: hexAt('C1-3'), seed: 0, target: hexAt('C1-2') }, words)
    expect(cast.phase).toBe('refresh')
    const done = applyAction(cast, { type: 'refresh', setAside: [] }, words)
    expect(done.phase).toBe('over')
    expect(done.tangled.sort()).toEqual([0, 2])
  })
})
