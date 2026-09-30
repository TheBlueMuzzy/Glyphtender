/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { simulateGame, simulateMany } from './sim'
import { parseWordList } from './words'
import { wordsOf } from './testkit'

// A small word list so random players make words now and then; the greedy games use the official list.
const words = wordsOf('AT', 'TA', 'AN', 'NA', 'IN', 'IT', 'TO', 'ON', 'NO', 'ES', 'RE', 'ER', 'EAT', 'TEA', 'ATE', 'NET', 'TEN', 'SET', 'RAT', 'TAR', 'ART')
const official = parseWordList(readFileSync(new URL('../../public/words/words.csv', import.meta.url), 'utf8'))

describe('random-player simulation (rules never break)', () => {
  for (const players of [2, 3, 4]) {
    for (const boardName of ['small', 'large']) {
      it(`${players} players on ${boardName}: 50 games finish with every invariant kept`, () => {
        const summary = simulateMany(players, boardName, 50, words)
        expect(summary.games).toBe(50)
        expect(summary.maxTurns).toBeLessThan(1000)
      })
    }
  }

  it('greedy players with the official word list: 5 games each for 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      const summary = simulateMany(players, players === 2 ? 'small' : 'large', 5, official, 'greedy')
      expect(summary.scoringTurnPct).toBeGreaterThan(0)
    }
  })

  it('replays exactly from the same seed', () => {
    const a = simulateGame({ players: 3, boardName: 'large', seed: 77, words })
    const b = simulateGame({ players: 3, boardName: 'large', seed: 77, words })
    expect(a).toEqual(b)
  })
})
