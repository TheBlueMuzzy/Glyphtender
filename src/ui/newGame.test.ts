import { describe, expect, it } from 'vitest'
import { boardNames, defaultChoices, loadChoices, saveChoices, withPlayers } from './newGame'

// A pretend browser storage
function memory(start: Record<string, string> = {}) {
  const data = { ...start }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v }, data }
}

describe('new game choices', () => {
  it('the boards come from boards.json', () => {
    expect(boardNames()).toEqual(['small', 'large'])
  })

  it('first time: 2 players on the Small garden, 2-letter words on, seeds NOT hidden (opt in), word indicators on', () => {
    expect(defaultChoices()).toEqual({ players: 2, boardName: 'small', twoLetterWords: true, hideSeeds: false, wordIndicators: true })
    expect(loadChoices(memory())).toEqual(defaultChoices())
    expect(loadChoices(null)).toEqual(defaultChoices()) // no storage at all
  })

  it('changing the player count picks that count\'s default garden', () => {
    expect(withPlayers(defaultChoices(), 3).boardName).toBe('large')
    expect(withPlayers(defaultChoices(), 2).boardName).toBe('small')
  })

  it('the last choices are remembered', () => {
    const storage = memory()
    const mine = { players: 3, boardName: 'small', twoLetterWords: false, hideSeeds: false, wordIndicators: false }
    saveChoices(mine, storage)
    expect(loadChoices(storage)).toEqual(mine)
  })

  it('a player who saved "hide seeds" on keeps it (the default is off)', () => {
    const storage = memory()
    saveChoices({ ...defaultChoices(), hideSeeds: true }, storage)
    expect(loadChoices(storage).hideSeeds).toBe(true)
    // an old save from before the option existed falls back to the default: off
    const old = memory({ 'glyphtender:new-game': JSON.stringify({ players: 2, boardName: 'small' }) })
    expect(loadChoices(old).hideSeeds).toBe(false)
  })

  it('odd or broken saved choices fall back to sensible ones', () => {
    const broken = memory({ 'glyphtender:new-game': '{not json' })
    expect(loadChoices(broken)).toEqual(defaultChoices())
    const odd = memory({ 'glyphtender:new-game': JSON.stringify({ players: 9, boardName: 'huge', twoLetterWords: 'yes' }) })
    expect(loadChoices(odd)).toEqual(defaultChoices())
    const refuses = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadChoices(refuses)).toEqual(defaultChoices())
    expect(() => saveChoices(defaultChoices(), refuses)).not.toThrow()
  })
})
