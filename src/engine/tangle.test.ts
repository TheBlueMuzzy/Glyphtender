import { describe, expect, it } from 'vitest'
import { applyAction } from './engine'
import { tangleBonus, tangledIds, winnersOf } from './tangle'
import { hexAt, position, wordsOf } from './testkit'
import type { GameState } from './types'

const words = wordsOf()
// Corner hexes on the small board: C1-1 touches only C1-2, C2-2, C2-3; C11-1 touches only C11-2, C10-2, C10-3.

/** Yellow's glyphling 0 in the C1-1 corner with 2 of its 3 neighbours taken by Blue seeds; Blue's glyphling 2 hemmed in at C11-1. */
function nearlyOver(extra: Partial<GameState> = {}): GameState {
  const s = position({
    glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C6-5' },
    seeds: [{ 'C10-2': 'A', 'C10-3': 'B' }, { 'C2-2': 'C', 'C2-3': 'D', 'C11-2': 'E' }],
    hands: [['S'], ['T']],
  })
  return { ...s, ...extra }
}
/** Yellow moves glyphling 1 up one hex and casts into the last open hex next to glyphling 0 — tangling its own glyphling. */
const selfTangle = { type: 'turn' as const, glyphling: 1, to: hexAt('C1-3'), seed: 0, target: hexAt('C1-2') }

describe('tangled (GDD §4.9)', () => {
  it('a glyphling with no legal move is tangled', () => {
    const s = nearlyOver()
    expect(tangledIds(s)).toEqual([2])
  })

  it('one tangle does not end the game', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-4', 2: 'C11-1', 3: 'C3-4' }, seeds: [{ 'C10-2': 'A', 'C10-3': 'B' }, { 'C11-2': 'E' }], hands: [['S'], ['T']] })
    const next = applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-4'), seed: 0, target: hexAt('C6-5') }, words)
    expect(next.tangled).toEqual([2])
    expect(next.phase).toBe('play')
    expect(next.current).toBe(1)
  })

  it('ends the game when a turn finishes with 2 glyphlings tangled', () => {
    const next = applyAction(nearlyOver(), selfTangle, words)
    expect(next.tangled.sort()).toEqual([0, 2])
    expect(next.phase).toBe('over')
  })

  it('uses tanglesToEnd from the rules', () => {
    const s = nearlyOver()
    const next = applyAction({ ...s, config: { ...s.config, rules: { ...s.config.rules, tanglesToEnd: 3 } } }, selfTangle, words)
    expect(next.phase).toBe('play')
  })

  it('is checked fresh every turn: a glyphling hemmed in by another glyphling is freed when that one moves away', () => {
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C1-2', 3: 'C8-5' },
      seeds: [{}, { 'C2-2': 'C', 'C2-3': 'D' }],
      hands: [['S'], ['T']],
    })
    // Yellow plays somewhere else; glyphling 0 is tangled by Blue's glyphling on C1-2.
    const a = applyAction(s, { type: 'turn', glyphling: 1, to: hexAt('C6-4'), seed: 0, target: hexAt('C6-5') }, words)
    expect(a.tangled).toEqual([0])
    // Blue walks its glyphling away down the column; glyphling 0 can move again.
    const b = applyAction(a, { type: 'turn', glyphling: 2, to: hexAt('C1-4'), seed: 0, target: hexAt('C1-3') }, words)
    expect(b.tangled).toEqual([])
    expect(b.phase).toBe('play')
  })
})

describe('tangle bonus (GDD §4.10)', () => {
  it('gives each OTHER player +3 per seed or glyphling of theirs next to a tangled glyphling', () => {
    const next = applyAction(nearlyOver(), selfTangle, words)
    // Glyphling 0 (Yellow): Yellow's own seed on C1-2 gives nothing; Blue's 2 seeds give Blue 6.
    // Glyphling 2 (Blue): Yellow's 2 seeds give Yellow 6; Blue's own seed on C11-2 gives nothing.
    expect(next.tangleMagic).toEqual([6, 6])
    expect(next.magic).toEqual([6, 6])
    expect(next.winners).toEqual([0, 1]) // a tie shares the win
  })

  it('counts glyphlings too, and self-tangling next to your own pieces gives rivals nothing', () => {
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C1-2', 2: 'C11-1', 3: 'C10-2' },
      seeds: [{ 'C2-2': 'A', 'C2-3': 'B' }, { 'C11-2': 'E', 'C10-3': 'F' }],
    })
    // Glyphling 0 is walled in only by Yellow's own pieces; glyphling 2 only by Blue's own pieces.
    expect(tangledIds(s).sort()).toEqual([0, 2])
    expect(tangleBonus(s, [0, 2])).toEqual([0, 0])
    const mixed = { ...s, glyphlings: s.glyphlings.map((g) => (g.id === 3 ? { ...g, hex: hexAt('C6-5') } : g)), seeds: { ...s.seeds } }
    // Move Blue's glyphling away and let a Yellow glyphling stand next to glyphling 2 instead: Yellow +3 for it.
    const withYellow = { ...mixed, glyphlings: [...mixed.glyphlings.filter((g) => g.id !== 1), { id: 1, seat: 0, hex: hexAt('C10-2') }] }
    expect(tangleBonus(withYellow, [2])).toEqual([3, 0])
  })

  it('adds the bonus to Magic, then the most Magic wins', () => {
    const next = applyAction(nearlyOver({ magic: [2, 5] }), selfTangle, words)
    expect(next.magic).toEqual([8, 11])
    expect(next.winners).toEqual([1])
  })

  it('winnersOf shares ties', () => {
    expect(winnersOf([3, 7, 7, 1])).toEqual([1, 2])
  })
})
