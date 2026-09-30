// B002 — the word list failing to load must not leave Cast / End turn waiting forever.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hexAt, position } from '../engine/testkit'
import { useGameStore } from './gameStore'

const store = () => useGameStore.getState()

/** Yellow to play with glyphling 0 at C6-7 and the given hand (an empty hand = a move-only turn). */
function yellowToPlay(hand: string[]) {
  store().loadState(position({
    glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
    hands: [hand, ['E']],
    bag: ['V', 'W', 'X', 'Y', 'Z'],
  }))
}

beforeEach(() => {
  store().leaveGame()
  useGameStore.setState({ words: null, wordsStatus: 'failed' }) // the word list never arrived
})
afterEach(() => vi.unstubAllGlobals())

describe('B002 — no word list', () => {
  it('End turn on a move-only turn does not wait for the words (it never needs them)', () => {
    yellowToPlay([]) // no seeds: nothing to cast
    const before = store().game
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().startCast()
    expect(store().note).toBeNull()
    expect(store().game).not.toBe(before)
    expect(store().game?.lastTurn?.to).toEqual(hexAt('C6-6'))
  })

  it('Cast with a seed says the words could not be loaded (not "one moment")', () => {
    yellowToPlay(['B'])
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    expect(store().note).toBe('wordsFailed')
    expect(store().flying).toBe(false)
  })

  it('a failed load can be retried, and the retry fetches the list again', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('AT,1.00\nTA,1.00\n'))
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useGameStore.setState({ wordsStatus: 'idle' })
    await store().loadWords('/words/words.csv')
    expect(store().wordsStatus).toBe('failed')
    await store().loadWords('/words/words.csv') // Retry
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(store().wordsStatus).toBe('ready')
    expect(store().words?.size).toBeGreaterThan(0)
  })
})
