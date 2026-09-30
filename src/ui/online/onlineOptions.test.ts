import { describe, expect, it } from 'vitest'
import { defaultOnlineOptions, loadOnlineOptions, saveOnlineOptions } from './onlineOptions'

// A pretend browser storage
const memory = () => {
  const saved = new Map<string, string>()
  return { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => void saved.set(key, value) }
}

describe('the host’s online table options', () => {
  it('first time: the garden picked by player count, the timer off', () => {
    expect(loadOnlineOptions(memory())).toEqual(defaultOnlineOptions())
    expect(defaultOnlineOptions()).toMatchObject({ boardName: 'auto', turnSeconds: 0 })
  })

  it('remembers the last choices, and falls back where a saved value no longer fits', () => {
    const storage = memory()
    saveOnlineOptions({ boardName: 'large', minWordLength: 3, turnSeconds: 90 }, storage)
    expect(loadOnlineOptions(storage)).toEqual({ boardName: 'large', minWordLength: 3, turnSeconds: 90 })
    storage.setItem('glyphtender:online-options', JSON.stringify({ boardName: 'huge', minWordLength: 9, turnSeconds: 45 }))
    expect(loadOnlineOptions(storage)).toEqual(defaultOnlineOptions())
    storage.setItem('glyphtender:online-options', 'not json')
    expect(loadOnlineOptions(storage)).toEqual(defaultOnlineOptions())
  })
})
