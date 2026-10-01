import { describe, expect, it } from 'vitest'
import { newGame } from '../engine/setup'
import type { LogTurn } from '../engine/types'
import { awardText, bestCells, markerCaption, scorecardRows, tangleBonusCaption, turnCaption } from './endText'
import type { Award, Scorecard } from './stats'

const names = ['Yellow', 'Blue', 'Purple', 'Pink']
const name = (seat: number) => names[seat]
const award = (id: Award['id'], values: Award['values'], holder = 0): Award => ({ id, holder, seats: [holder], moment: 3, values })
const turn = (extra: Partial<LogTurn>): LogTurn => ({
  turnNo: 7, round: 4, seat: 1, glyphlingId: 2, from: { q: 0, r: 0 }, to: { q: 0, r: 1 }, letter: 'N', target: { q: 1, r: 1 },
  words: [], magic: 0, refreshed: 0, refresh: false, totalsAfter: [0, 0], tangledAfter: [], newlyTangled: [], freed: [], ...extra,
})

describe('award words', () => {
  it('fills in the numbers and words', () => {
    expect(awardText(award('biggestTurn', { n: 14, words: 'GARDEN + DEN' }), name)).toEqual({ title: 'Biggest turn', reason: '+14 Magic in one cast: GARDEN + DEN' })
  })
  it('names the other player (Knot tier)', () => {
    expect(awardText(award('knotTier', { other: 2, n: 1 }, 1), name).reason).toBe("Tangled Purple's glyphling")
  })
  it('the deciding moment can be the tangles; a brave knot can win', () => {
    expect(awardText(award('deciding', { n: 9, tangles: true }), name).reason).toBe('The tangles decided it: +9 at the very end')
    expect(awardText(award('braveKnot', { won: true }), name).reason).toMatch(/and won!/)
    expect(awardText(award('braveKnot', { won: false }), name).reason).toMatch(/Bold!/)
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
    bestWord: null, bestTurn: null, multiWordTurns: 0, seedsRefreshed: 3, tangledRivals: 0, gotTangled: 1, lettersBorrowed: 0, lettersGiven: 0,
  })
  it('the 2-letter row only when 2-letter words count', () => {
    const two = newGame({ players: 2, seed: 1 })
    const three = newGame({ players: 2, seed: 1, rules: { minWordLength: 3 } })
    const labels = (g: typeof two) => scorecardRows(g, [card(0), card(1)], [1, 0]).flatMap((group) => group.rows.map((r) => r.label))
    expect(labels(two)).toContain('2-letter')
    expect(labels(three)).not.toContain('2-letter')
    expect(labels(three)).toContain('6+ letters')
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
