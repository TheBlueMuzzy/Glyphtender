import { describe, expect, it } from 'vitest'
import { applyAction, checkAction } from './engine'
import { DIRECTIONS, addHex, hexKey, sameHex, type Hex } from './hex'
import { legalCasts, legalMoves } from './moves'
import { hexAt, position, wordsOf } from './testkit'

const words = wordsOf()
const has = (list: Hex[], label: string) => list.some((h) => sameHex(h, hexAt(label)))
/** The hex `n` steps from `label` in direction `dir` (0 N, 1 NE, 2 SE, 3 S, 4 SW, 5 NW). */
function step(label: string, dir: number, n = 1): Hex {
  let h = hexAt(label)
  for (let i = 0; i < n; i++) h = addHex(h, DIRECTIONS[dir])
  return h
}

describe('move (GDD §4.4)', () => {
  it('goes any distance in a straight line along the 6 directions', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' } })
    const moves = legalMoves(s, 0)
    expect(has(moves, 'C6-1')).toBe(true) // straight up to the top
    expect(has(moves, 'C6-9')).toBe(true) // straight down to the bottom
    expect(moves.some((h) => sameHex(h, step('C6-5', 2, 3)))).toBe(true)
    expect(moves.some((h) => sameHex(h, hexAt('C6-5')))).toBe(false) // must move at least 1 hex
  })

  it('cannot pass through or land on a seed (anyone’s)', () => {
    const s = position({
      glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C6-3': 'A' }, { 'C6-7': 'B' }],
    })
    const moves = legalMoves(s, 0)
    expect(has(moves, 'C6-4')).toBe(true)
    expect(has(moves, 'C6-3')).toBe(false)
    expect(has(moves, 'C6-2')).toBe(false)
    expect(has(moves, 'C6-6')).toBe(true)
    expect(has(moves, 'C6-7')).toBe(false)
    expect(has(moves, 'C6-8')).toBe(false)
  })

  it('cannot pass through or land on a glyphling (own or another player’s)', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C6-3', 2: 'C6-7', 3: 'C11-4' } })
    const moves = legalMoves(s, 0)
    expect(has(moves, 'C6-4')).toBe(true)
    expect(has(moves, 'C6-3')).toBe(false)
    expect(has(moves, 'C6-2')).toBe(false)
    expect(has(moves, 'C6-8')).toBe(false)
  })

  it('refuses a move that is not in a straight line or is blocked', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' }, seeds: [{ 'C6-3': 'A' }], hands: [['T']] })
    const bent = { type: 'turn' as const, glyphling: 0, to: addHex(step('C6-5', 3), DIRECTIONS[2]), seed: 0, target: hexAt('C6-5') }
    expect(checkAction(s, bent)).toMatch(/straight line/)
    const blocked = { type: 'turn' as const, glyphling: 0, to: hexAt('C6-2'), seed: 0, target: hexAt('C6-5') }
    expect(() => applyAction(s, blocked, words)).toThrow(/straight line/)
  })

  it('only lets you move your own glyphling, on your turn', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C3-4' }, hands: [['A'], ['B']] })
    const action = { type: 'turn' as const, glyphling: 3, to: step('C3-4', 3), seed: 0, target: hexAt('C3-4') }
    expect(checkAction(s, action)).toMatch(/another player/)
    expect(checkAction({ ...s, current: 1 }, action)).toBeNull()
  })
})

describe('cast (GDD §4.5)', () => {
  it('flies over your own seeds and glyphlings, any distance, onto empty hexes', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C6-3', 2: 'C11-1', 3: 'C11-4' }, seeds: [{ 'C6-4': 'A' }] })
    const casts = legalCasts(s, 0, hexAt('C6-5'))
    expect(has(casts, 'C6-4')).toBe(false) // occupied by own seed
    expect(has(casts, 'C6-3')).toBe(false) // occupied by own glyphling
    expect(has(casts, 'C6-2')).toBe(true) // over both
    expect(has(casts, 'C6-1')).toBe(true)
  })

  it('stops at another player’s seed or glyphling', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C6-8', 3: 'C11-4' }, seeds: [{}, { 'C6-3': 'B' }] })
    const casts = legalCasts(s, 0, hexAt('C6-5'))
    expect(has(casts, 'C6-4')).toBe(true)
    expect(has(casts, 'C6-2')).toBe(false) // behind a Blue seed
    expect(has(casts, 'C6-7')).toBe(true)
    expect(has(casts, 'C6-9')).toBe(false) // behind a Blue glyphling
  })

  it('can target the hex the glyphling just left', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' }, hands: [['A']] })
    const to = hexAt('C6-4')
    expect(has(legalCasts(s, 0, to), 'C6-5')).toBe(true)
    const next = applyAction(s, { type: 'turn', glyphling: 0, to, seed: 0, target: hexAt('C6-5') }, words)
    expect(next.seeds[hexKey(hexAt('C6-5'))]).toEqual({ letter: 'A', seat: 0 })
  })

  it('refuses a target that is not a legal cast', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C6-8', 3: 'C11-4' }, hands: [['A']] })
    const action = { type: 'turn' as const, glyphling: 0, to: hexAt('C6-4'), seed: 0, target: hexAt('C6-9') }
    expect(() => applyAction(s, action, words)).toThrow(/straight line onto an empty hex/)
    expect(checkAction(s, { ...action, target: hexAt('C6-8') })).not.toBeNull() // a glyphling stands there
    expect(checkAction(s, { ...action, seed: 3, target: hexAt('C6-5') })).toMatch(/not in your hand/)
  })
})

describe('you must cast if you can (GDD §4.8)', () => {
  it('refuses move-only when a cast is possible', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' }, hands: [['A']] })
    const action = { type: 'turn' as const, glyphling: 0, to: hexAt('C6-4'), seed: null, target: null }
    expect(checkAction(s, action)).toMatch(/must cast/)
  })

  it('allows move-only with an empty hand', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' }, hands: [[], ['B']] })
    const next = applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-4'), seed: null, target: null }, words)
    expect(sameHex(next.glyphlings[0].hex, hexAt('C6-4'))).toBe(true)
    expect(Object.keys(next.seeds)).toHaveLength(0)
  })

  it('always has somewhere to cast after a move: the path back is open (so "can’t cast" means "no seeds")', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' } })
    for (const to of legalMoves(s, 0)) expect(legalCasts(s, 0, to).length).toBeGreaterThan(0)
  })
})

describe('after the cast', () => {
  it('moves the seed from hand to board and passes play to the next seat, leaving the old state alone', () => {
    const s = position({ glyphlings: { 0: 'C6-5', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' }, hands: [['A', 'Q'], ['B']] })
    const copy = JSON.parse(JSON.stringify(s))
    const next = applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-4'), seed: 1, target: hexAt('C6-2') }, words)
    expect(s).toEqual(copy)
    expect(next.hands[0]).toEqual(['A'])
    expect(next.seeds[hexKey(hexAt('C6-2'))]).toEqual({ letter: 'Q', seat: 0 })
    expect(next.current).toBe(1)
    expect(next.lastTurn?.letter).toBe('Q')
  })
})
