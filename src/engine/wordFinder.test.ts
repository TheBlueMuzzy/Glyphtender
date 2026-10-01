/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getBoard } from './boards'
import { DIRECTIONS, addHex, type Hex } from './hex'
import { findWords } from './wordFinder'
import { parseWordList } from './words'
import { hexAt, position, wordsOf, type SeedPlan } from './testkit'
import type { RuleNumbers } from './types'

const official = parseWordList(readFileSync(new URL('../../public/words/words.csv', import.meta.url), 'utf8'))
const N = 0, NE = 1, SE = 2, S = 3 // direction numbers (hex.ts DIRECTIONS)

/** Seeds laid in a line from `start`, one per step in direction `dir`. "Qu" is one seed. */
function line(start: string, dir: number, letters: string[], boardName = 'small'): { plan: SeedPlan; hexes: Hex[] } {
  const board = getBoard(boardName)
  const plan: SeedPlan = {}
  const hexes: Hex[] = []
  let h = hexAt(start, boardName)
  for (const letter of letters) {
    plan[board.label(h)] = letter
    hexes.push(h)
    h = addHex(h, DIRECTIONS[dir])
  }
  return { plan, hexes }
}

/** The words made by the seed at index `newSeed` of a line of letters. */
function wordsMade(start: string, dir: number, letters: string[], newSeed: number, list = official, rules?: Partial<RuleNumbers>) {
  const { plan, hexes } = line(start, dir, letters)
  const s = position({ glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, seeds: [plan], rules })
  return findWords(s, hexes[newSeed], list).map((w) => w.word)
}

describe('word finder — the union rule (GDD §4.6)', () => {
  it('GARDENING scores; GARDEN and DEN inside it do not', () => {
    const letters = [...'GARDENING']
    expect(wordsMade('C6-1', S, letters, 4, wordsOf('GARDENING', 'GARDEN', 'DEN'))).toEqual(['GARDENING'])
    expect(wordsMade('C6-1', S, letters, 4)).toEqual(['GARDENING']) // same with the official list
  })

  it('SEAL + LEAP both score; ALE (covered by the two together) does not', () => {
    const letters = [...'SEALEAP']
    expect(wordsMade('C6-1', S, letters, 3, wordsOf('SEAL', 'LEAP', 'ALE', 'LEA'))).toEqual(['SEAL', 'LEAP'])
    expect(wordsMade('C6-1', S, letters, 3)).toEqual(['SEAL', 'LEAP'])
  })

  it('HEL_EA + P scores both HELP and PEA', () => {
    const letters = [...'HELPEA']
    expect(wordsMade('C6-1', S, letters, 3, wordsOf('HELP', 'PEA', 'PE'))).toEqual(['HELP', 'PEA'])
    expect(wordsMade('C6-1', S, letters, 3)).toEqual(['HELP', 'PEA'])
  })

  it('only counts words through the new seed, in an unbroken run', () => {
    // CAT + gap + DOG on one line: casting the D only finds DOG.
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C6-1': 'C', 'C6-2': 'A', 'C6-3': 'T', 'C6-5': 'D', 'C6-6': 'O', 'C6-7': 'G' }],
    })
    expect(findWords(s, hexAt('C6-5'), wordsOf('CAT', 'DOG')).map((w) => w.word)).toEqual(['DOG'])
  })
})

describe('reading direction (GDD §4.6: top-to-bottom / left-to-right)', () => {
  const list = wordsOf('AT')
  it('reads top → bottom, never bottom → top', () => {
    expect(wordsMade('C6-3', S, ['A', 'T'], 1, list)).toEqual(['AT'])
    expect(wordsMade('C6-3', N, ['A', 'T'], 1, list)).toEqual([]) // spells TA going down
  })

  it('reads NW → SE (left to right, going down)', () => {
    expect(wordsMade('C4-4', SE, ['A', 'T'], 1, list)).toEqual(['AT'])
  })

  it('reads SW → NE (left to right, going up)', () => {
    expect(wordsMade('C4-4', NE, ['A', 'T'], 1, list)).toEqual(['AT'])
    expect(wordsMade('C5-4', 4, ['A', 'T'], 0, list)).toEqual([]) // laid SW: spells TA left to right
  })

  it('scores words on different leylines through the same seed, sharing it', () => {
    // A vertical CAT and a SW→NE "TO" share the T.
    const cat = line('C6-2', S, ['C', 'A', 'T'])
    const t = cat.hexes[2]
    const o = addHex(t, DIRECTIONS[NE])
    const planO = { ...cat.plan, [getBoard('small').label(o)]: 'O' }
    const s = position({ glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, seeds: [planO] })
    expect(findWords(s, t, wordsOf('CAT', 'TO')).map((w) => w.word).sort()).toEqual(['CAT', 'TO'])
  })
})

describe('plain Q and minimum length', () => {
  it('Q is one seed that spells Q: QI is 2 seeds, QUA is 3 (the U is its own seed)', () => {
    expect(wordsMade('C6-2', S, ['Q', 'I'], 0, wordsOf('QI'))).toEqual(['QI'])
    expect(wordsMade('C6-2', S, ['Q', 'U', 'A'], 0, wordsOf('QUA'))).toEqual(['QUA'])
    const { plan, hexes } = line('C6-2', S, ['Q', 'U', 'A'])
    const s = position({ glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, seeds: [plan] })
    expect(findWords(s, hexes[2], wordsOf('QUA'))[0].hexes).toHaveLength(3)
  })

  it('a Q and an A without a U between them do not spell QUA', () => {
    expect(wordsMade('C6-2', S, ['Q', 'A'], 0, wordsOf('QUA'))).toEqual([])
  })

  it('min length counts seeds: QUA is too short when words need 4 seeds', () => {
    expect(wordsMade('C6-2', S, ['Q', 'U', 'A'], 0, wordsOf('QUA'), { minWordLength: 4 })).toEqual([])
  })

  it('min length 2 by default; the "3" table option drops 2-seed words', () => {
    expect(wordsMade('C6-3', S, ['A', 'T'], 1, wordsOf('AT'))).toEqual(['AT'])
    expect(wordsMade('C6-3', S, ['A', 'T'], 1, wordsOf('AT'), { minWordLength: 3 })).toEqual([])
  })
})
