import { describe, expect, it } from 'vitest'
import { applyAction } from './engine'
import { legalDraftHexes } from './draft'
import { getBoard } from './boards'
import { isEdge, neighbours, sameHex } from './hex'
import { nextRandom, shuffle } from './rng'
import { fullBag, newGame, snakeOrder } from './setup'
import { hexAt, wordsOf } from './testkit'
import type { GameState } from './types'

const words = wordsOf()

/** Runs the whole draft, always picking the first legal hex. */
function draftAll(state: GameState): GameState {
  let s = state
  while (s.phase === 'draft') s = applyAction(s, { type: 'draft', hex: legalDraftHexes(s)[0] }, words)
  return s
}

describe('seeded random', () => {
  it('gives the same numbers from the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42))
    expect(nextRandom(42).value).not.toBe(nextRandom(43).value)
  })

  it('shuffles without changing the input and keeps every item', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(7, items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out.items].sort()).toEqual(items)
    expect(shuffle(7, items)).toEqual(out)
  })
})

describe('the bag (GDD §4.3)', () => {
  it('holds 120 seeds: one plain Q (no "Qu"), five U, fifteen E (Muzzy, 2026-10-01)', () => {
    const bag = fullBag()
    expect(bag).toHaveLength(120)
    expect(bag.filter((s) => s === 'Q')).toHaveLength(1)
    expect(bag).not.toContain('Qu')
    expect(bag.filter((s) => s === 'U')).toHaveLength(5)
    expect(bag.filter((s) => s === 'E')).toHaveLength(15)
    expect(bag.every((s) => /^[A-Z]$/.test(s))).toBe(true)
  })

  it('is shuffled by the game seed — same seed, same bag', () => {
    const a = newGame({ players: 2, seed: 5 })
    expect(a.bag).toHaveLength(120)
    expect(newGame({ players: 2, seed: 5 }).bag).toEqual(a.bag)
    expect(newGame({ players: 2, seed: 6 }).bag).not.toEqual(a.bag)
  })
})

describe('new game', () => {
  it('starts in the draft with the board for the player count', () => {
    expect(newGame({ players: 2, seed: 1 }).config.boardName).toBe('small')
    expect(newGame({ players: 3, seed: 1 }).config.boardName).toBe('large')
    const g = newGame({ players: 4, seed: 1 })
    expect(g.phase).toBe('draft')
    expect(g.hands).toEqual([[], [], [], []])
    expect(g.config.rules.handSize).toBe(8)
  })

  it('refuses silly player counts and unknown boards', () => {
    expect(() => newGame({ players: 1, seed: 1 })).toThrow(/2–4/)
    expect(() => newGame({ players: 5, seed: 1 })).toThrow(/2–4/)
    expect(() => newGame({ players: 2, seed: 1, boardName: 'tiny' })).toThrow(/Unknown board/)
  })
})

describe('snake draft (GDD §4.2)', () => {
  it('uses 1-2-2-1, 1-2-3-3-2-1 and 1-2-3-4-4-3-2-1', () => {
    expect(snakeOrder(2)).toEqual([0, 1, 1, 0])
    expect(snakeOrder(3)).toEqual([0, 1, 2, 2, 1, 0])
    expect(snakeOrder(4)).toEqual([0, 1, 2, 3, 3, 2, 1, 0])
  })

  it('follows the snake order, placing 2 glyphlings per seat', () => {
    let s = newGame({ players: 3, seed: 1 })
    const seen: number[] = []
    while (s.phase === 'draft') {
      seen.push(s.current)
      s = applyAction(s, { type: 'draft', hex: legalDraftHexes(s)[0] }, words)
    }
    expect(seen).toEqual([0, 1, 2, 2, 1, 0])
    expect(s.glyphlings.map((g) => [g.id, g.seat]).sort((a, b) => a[0] - b[0])).toEqual([
      [0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2],
    ])
  })

  it('only offers inner, empty hexes that are not next to a glyphling', () => {
    const board = getBoard('small')
    let s = newGame({ players: 2, seed: 1 })
    s = applyAction(s, { type: 'draft', hex: hexAt('C6-5') }, words)
    const legal = legalDraftHexes(s)
    for (const h of legal) expect(isEdge(board, h)).toBe(false)
    expect(legal.some((h) => sameHex(h, hexAt('C6-5')))).toBe(false)
    for (const n of neighbours(board, hexAt('C6-5'))) expect(legal.some((h) => sameHex(h, n))).toBe(false)
  })

  it('refuses an edge hex, an occupied hex and a hex next to a glyphling', () => {
    let s = newGame({ players: 2, seed: 1 })
    expect(() => applyAction(s, { type: 'draft', hex: hexAt('C1-1') }, words)).toThrow(/inner hex/)
    s = applyAction(s, { type: 'draft', hex: hexAt('C6-5') }, words)
    expect(() => applyAction(s, { type: 'draft', hex: hexAt('C6-5') }, words)).toThrow()
    expect(() => applyAction(s, { type: 'draft', hex: hexAt('C6-6') }, words)).toThrow()
  })

  it('deals 8 seeds to everyone after the last placement, then seat 0 plays', () => {
    const before = newGame({ players: 4, seed: 9 })
    const s = draftAll(before)
    expect(s.phase).toBe('play')
    expect(s.current).toBe(0)
    expect(s.hands.map((h) => h.length)).toEqual([8, 8, 8, 8])
    expect(s.bag).toHaveLength(120 - 32)
    expect(s.hands[0]).toEqual(before.bag.slice(0, 8)) // dealt from the front, in seat order
    expect(s.hands[1]).toEqual(before.bag.slice(8, 16))
  })

  it('never changes the state it was given', () => {
    const s = newGame({ players: 2, seed: 3 })
    const copy = JSON.parse(JSON.stringify(s))
    draftAll(s)
    expect(s).toEqual(copy)
  })

  it('refuses draft actions once play has started', () => {
    const s = draftAll(newGame({ players: 2, seed: 3 }))
    expect(() => applyAction(s, { type: 'draft', hex: hexAt('C6-5') }, words)).toThrow(/draft is over/)
  })
})
