import { describe, expect, it } from 'vitest'
import { newGame } from '../engine/setup'
import type { LogTurn } from '../engine/types'
import { awardText, bestCells, markerCaption, scorecardRows, tangleBonusCaption, turnCaption } from './endText'
import type { Award, Scorecard } from './stats'

const names = ['Yellow', 'Blue', 'Purple', 'Pink']
const name = (seat: number) => names[seat]
const award = (id: Award['id'], values: Award['values'], holder = 0): Award => ({ id, holder, seats: [holder], moment: 3, values, effect: 1 })
const turn = (extra: Partial<LogTurn>): LogTurn => ({
  turnNo: 7, round: 4, seat: 1, glyphlingId: 2, from: { q: 0, r: 0 }, to: { q: 0, r: 1 }, letter: 'N', target: { q: 1, r: 1 },
  words: [], magic: 0, refreshed: 0, refresh: false, totalsAfter: [0, 0], tangledAfter: [], newlyTangled: [], freed: [], ...extra,
})

describe('award words', () => {
  it('fills in the proof: "Blue’s glyphling: 9 moves → 2"', () => {
    expect(awardText(award('lockdown', { other: 1, from: 9, to: 2 }), name)).toEqual({ title: 'Lockdown', reason: "Blue's glyphling: 9 moves → 2" })
  })
  it('Weed toss: a taken spot or a cut, and whether they refreshed after', () => {
    expect(awardText(award('weedToss', { kind: 'block', other: 2, n: 8, word: 'GARDEN', refreshed: false }), name).reason).toBe("A junk seed took Purple's +8 spot (GARDEN)")
    expect(awardText(award('weedToss', { kind: 'cut', other: 1, from: 6, to: 1, refreshed: true }), name).reason).toBe("A junk seed cut Blue's glyphling: 6 moves → 1, then refreshed")
  })
  it('Trickster’s Victory names who ended it', () => {
    expect(awardText(award('trickster', { other: 3, n: 5 }), name).reason).toBe('Pink ended the game 5 behind')
  })
})

describe('chart captions', () => {
  it('a cast that grew words, one that grew none, a move only', () => {
    const words = [{ word: 'GARDEN', letters: [], owners: [], magic: 10, ownMagic: 2 }, { word: 'DEN', letters: [], owners: [], magic: 4, ownMagic: 1 }]
    expect(turnCaption(turn({ words, magic: 14 }), name)).toBe('Round 4 · Blue cast N: GARDEN + DEN, +14')
    expect(turnCaption(turn({}), name)).toBe('Round 4 · Blue cast N, no words')
    expect(turnCaption(turn({ letter: null }), name)).toBe('Round 4 · Blue moved')
  })
  it('the tangle bonus at the end', () => {
    const game = { ...newGame({ players: 3, seed: 1 }), tangleMagic: [6, 0, 3] }
    expect(tangleBonusCaption(game, name)).toBe('Tangles: Yellow +6 · Purple +3')
    expect(tangleBonusCaption({ ...game, tangleMagic: [0, 0, 0] }, name)).toBe('Tangles: nobody got a bonus')
  })
  it('a tangle mark: who tangled whom, or their own', () => {
    const game = { ...newGame({ players: 2, seed: 1 }), log: { turns: [turn({ turnNo: 7 })], end: null } }
    expect(markerCaption(game, { kind: 'tangle', seat: 0, x: 4, turnNo: 7, by: 1, glyphling: 0 }, [], name)).toBe("Round 4 · Blue tangled Yellow's glyphling")
    expect(markerCaption(game, { kind: 'tangle', seat: 1, x: 4, turnNo: 7, by: 1, glyphling: 2 }, [], name)).toBe('Round 4 · Blue tangled their own glyphling')
  })
})

describe('scorecard rows', () => {
  const card = (seat: number): Scorecard => ({
    seat, total: 10 + seat, wordMagic: 10, soloMagic: 2, tangleMagic: seat, byLength: [1, 2, 3, 0, 0], wordsMade: 6, longestWord: 'TREE',
    bestWord: null, bestTurn: null, multiWordTurns: 0, seedsRefreshed: 3, completeTangles: seat, lettersBorrowed: 0, lettersGiven: 0,
  })
  it('the 2-letter row only when 2-letter words count', () => {
    const two = newGame({ players: 2, seed: 1 })
    const three = newGame({ players: 2, seed: 1, rules: { minWordLength: 3 } })
    const labels = (g: typeof two) => scorecardRows(g, [card(0), card(1)], [1, 0]).flatMap((group) => group.rows.map((r) => r.label))
    expect(labels(two)).toContain('2-letter')
    expect(labels(three)).not.toContain('2-letter')
    expect(labels(three)).toContain('6+ letters')
  })
  it('Magic: Total, From words, From tangles, From solo words; Play: Multi-word turns, Seeds refreshed, Complete tangles', () => {
    const [magic, , play] = scorecardRows(newGame({ players: 2, seed: 1 }), [card(0), card(1)], [1, 0])
    expect(magic.rows.map((r) => r.label)).toEqual(['Total', 'From words', 'From tangles', 'From solo words'])
    expect(play.rows.map((r) => r.label)).toEqual(['Multi-word turns', 'Seeds refreshed', 'Complete tangles'])
    expect(play.rows[2].values).toEqual([1, 0])
    expect(play.rows[2].tint).toBe(true)
  })
  it('complete tangles unknown (an old log) → "–" for everyone, never tinted', () => {
    const old = (seat: number) => ({ ...card(seat), completeTangles: null })
    const [, , play] = scorecardRows(newGame({ players: 2, seed: 1 }), [old(0), old(1)], [1, 0])
    expect(play.rows[2].shown).toEqual(['–', '–'])
    expect(bestCells(play.rows[2])).toEqual([false, false])
  })
  it('columns follow the seats given (best place first)', () => {
    const [magic] = scorecardRows(newGame({ players: 2, seed: 1 }), [card(0), card(1)], [1, 0])
    expect(magic.rows[0].values).toEqual([11, 10])
  })
  it('the best in a row is tinted — ties share it; nobody when all are equal, 0, or the row is never "best"', () => {
    expect(bestCells({ label: '', values: [3, 5, 5, 1], tint: true })).toEqual([false, true, true, false])
    expect(bestCells({ label: '', values: [4, 4], tint: true })).toEqual([false, false])
    expect(bestCells({ label: '', values: [0, 0, 0], tint: true })).toEqual([false, false, false])
    expect(bestCells({ label: '', values: [1, 3], tint: false })).toEqual([false, false])
  })
})
