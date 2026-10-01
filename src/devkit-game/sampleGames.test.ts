// The Dev Kit's preview games are real, finished (or running) games — and the same every time.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseWordList } from '../engine/words'
import { finishedGame, midGame, tiedGame } from './sampleGames'

const words = parseWordList(readFileSync(new URL('../../public/words/words.csv', import.meta.url), 'utf8'))

describe('preview sample games', () => {
  it.each([2, 3, 4])('a %i-player game played to the end, with words made', (players) => {
    const { game, stats } = finishedGame(players, words)
    expect(game.phase).toBe('over')
    expect(game.config.players).toBe(players)
    expect(game.winners.length).toBeGreaterThan(0)
    expect(stats).toHaveLength(players)
    expect(stats.reduce((n, s) => n + s.wordsMade, 0)).toBeGreaterThan(0)
  })

  it('is the same every time', () => {
    expect(finishedGame(3, words).game.magic).toEqual(finishedGame(3, words).game.magic)
  })

  it('finds a 2-player game that ends in a tie', () => {
    const tie = tiedGame(words)
    expect(tie).not.toBeNull()
    expect(tie!.game.winners).toHaveLength(2)
    expect(tie!.game.magic[0]).toBe(tie!.game.magic[1])
  })

  it.each([2, 4])('a %i-player game still going, past the draft', (players) => {
    const { game } = midGame(players, words)
    expect(game.phase).toBe('play')
  })

  it.each([[2, 1], [3, 2], [4, 3]])('a %i-player game on seat %i\'s turn (the handoff previews)', (players, current) => {
    const { game } = midGame(players, words, { current })
    expect(game.phase).toBe('play')
    expect(game.current).toBe(current)
  })
})
