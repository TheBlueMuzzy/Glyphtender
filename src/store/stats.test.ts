import { describe, expect, it } from 'vitest'
import type { MadeWord, TurnSummary } from '../engine/types'
import { addTurn, emptyStats } from './stats'

const word = (w: string, magic: number): MadeWord => ({ word: w, hexes: [], magic })
const turn = (seat: number, words: MadeWord[]): TurnSummary => ({
  seat, glyphlingId: seat * 2, from: { q: 0, r: 0 }, to: { q: 0, r: 1 }, letter: 'A', target: { q: 0, r: 2 },
  words, magic: words.reduce((sum, w) => sum + w.magic, 0), drew: 1,
})

describe('end table stats', () => {
  it('best turn, longest word and words made add up turn by turn, for the player who played', () => {
    let stats = emptyStats(2)
    stats = addTurn(stats, turn(0, [word('AT', 3), word('TAN', 4)]))
    stats = addTurn(stats, turn(1, []))
    stats = addTurn(stats, turn(0, [word('GARDEN', 8)]))
    stats = addTurn(stats, turn(0, [word('ANT', 5)]))
    expect(stats).toEqual([
      { bestTurn: 8, longestWord: 'GARDEN', wordsMade: 4 },
      { bestTurn: 0, longestWord: '', wordsMade: 0 },
    ])
  })

  it('a tie in length keeps the first long word', () => {
    const stats = addTurn(addTurn(emptyStats(2), turn(1, [word('SEAL', 5)])), turn(1, [word('LEAP', 5)]))
    expect(stats[1].longestWord).toBe('SEAL')
  })

  it("the old stats aren't changed", () => {
    const before = emptyStats(2)
    addTurn(before, turn(0, [word('AT', 3)]))
    expect(before[0].wordsMade).toBe(0)
  })
})
