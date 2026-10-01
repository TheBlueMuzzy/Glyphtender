// B011: the refresh plays out on the tray — set-aside seeds shrink, new ones grow into their places — THEN play passes on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import anim from '../../content/tuning/anim.json'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { useGameStore } from './gameStore'
import { newSeedSlots, refillInPlace, refreshSlots, refreshTimes } from './refreshFx'
import { TRAY_GAP } from './turnPlan'

const store = () => useGameStore.getState()

describe('refresh maths', () => {
  it('the slots are the tray positions of the set-aside seeds, left to right', () => {
    expect(refreshSlots([0, 1, 2, 3], [2, 0])).toEqual([0, 2])
    expect(refreshSlots([3, 0, 2, 1], [1, 3])).toEqual([0, 3]) // a reordered tray: its own places
    expect(refreshSlots([0, 1, 2], [])).toEqual([])
  })

  it('new seeds take the set-aside places; kept seeds stay put', () => {
    // hand ABCDEFGH, set aside A (0) and C (2) → new hand BDEFGH + 2 drawn (indexes 6, 7)
    expect(refillInPlace([0, 1, 2, 3, 4, 5, 6, 7], [0, 2], 8)).toEqual([6, 0, 7, 1, 2, 3, 4, 5])
    // a reordered tray
    expect(refillInPlace([3, 0, 2, 1], [1, 3], 4)).toEqual([2, 0, 1, 3])
    // the bag ran short: one new seed for two places — the second place stays empty (nothing shifts)
    expect(refillInPlace([0, 1, 2, 3], [0, 2], 3)).toEqual([2, 0, TRAY_GAP, 1])
    // a short hand (an old 3-seed tray) refilled: the extra new seed goes on the end
    expect(refillInPlace([0, 1, 2], [1], 4)).toEqual([0, 2, 1, 3])
    // an empty place (a cast seed's, nothing drawn) is filled before the end; nothing new = it stays
    expect(refillInPlace([0, TRAY_GAP, 1, 2], [], 4)).toEqual([0, 3, 1, 2])
    expect(refillInPlace([0, TRAY_GAP, 1, 2], [], 3)).toEqual([0, TRAY_GAP, 1, 2])
    // a cast (one seed gone, one drawn): the drawn seed takes its place
    expect(refillInPlace([3, 0, 1, 2], [1], 4)).toEqual([2, 0, 3, 1])
    // an empty place at the end is just a free slot (the tray always shows a full hand's slots)
    expect(refillInPlace([0, 1, 2], [2], 2)).toEqual([0, 1])
  })

  it('the new seeds go where: every tray position holding a drawn seed', () => {
    expect(newSeedSlots([6, 0, 7, 1, 2, 3, 4, 5], 6)).toEqual([0, 2])
    expect(newSeedSlots([5, 0, 6, 1, 2, 3, 4, 7], 5)).toEqual([0, 2, 7])
  })

  it('how long each stage lasts: staggered slot after slot; nothing set aside or reduce motion = instant', () => {
    const t = { ...anim, refreshShrinkTime: 0.2, refreshGrowTime: 0.3, refreshStagger: 0.05, refreshPause: 0.1 }
    expect(refreshTimes(3, t, false)).toEqual({ shrinkMs: 400, growMs: 400 })
    expect(refreshTimes(1, t, false)).toEqual({ shrinkMs: 300, growMs: 300 })
    expect(refreshTimes(0, t, false)).toEqual({ shrinkMs: 0, growMs: 0 })
    expect(refreshTimes(3, t, true)).toEqual({ shrinkMs: 0, growMs: 0 })
  })
})

describe('the refresh plays out before play passes on (pass-and-play)', () => {
  /** Yellow has just cast a seed that made no Magic: refresh mode, 7 seeds B C D F G H J (K was cast). */
  function yellowRefreshing() {
    store().loadState(position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      hands: [['K', 'B', 'C', 'D', 'F', 'G', 'H', 'J'], ['E']],
      bag: ['V', 'W', 'X', 'Y', 'Z'],
    }))
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    store().startCast()
    store().finishCast()
    expect(store().game?.phase).toBe('refresh')
  }
  const { shrinkMs } = refreshTimes(2, anim, false) // 2 seeds go…
  const { growMs } = refreshTimes(3, anim, false) // …3 come (one more for the cast seed's place)

  beforeEach(() => {
    vi.useFakeTimers()
    store().leaveGame()
    store().setWords(wordsOf('AT', 'TA'))
    store().startGame({ players: 2, seed: 1, hideSeeds: true }) // (for the options: hide seeds → a handoff)
  })
  afterEach(() => vi.useRealTimers())

  it('shrink → grow → THEN the next player (and the handoff)', () => {
    yellowRefreshing()
    // (K was cast from tray place 0 — that place stays empty, nothing shifted: _ B C D F G H J)
    store().tapSeed(0) // B, tray place 1
    store().tapSeed(2) // D, tray place 3
    store().refresh()
    // 1. the set-aside seeds shrink; the game hasn't moved on
    expect(store().refreshFx).toMatchObject({ seat: 0, slots: [1, 3], stage: 'out' })
    expect(store().game?.phase).toBe('refresh')
    expect(store().handoff).toBeNull()
    vi.advanceTimersByTime(shrinkMs - 1)
    expect(store().refreshFx?.stage).toBe('out')
    // 2. the new seeds grow into the same places — shown from the refreshed hand, still Yellow's turn
    vi.advanceTimersByTime(1)
    const fx = store().refreshFx!
    expect(fx.stage).toBe('in')
    expect(fx.newSlots).toEqual([0, 1, 3]) // the cast seed's empty place + the set-aside places, left to right
    expect(fx.order!.map((i) => fx.hand![i])).toEqual(['V', 'W', 'C', 'X', 'F', 'G', 'H', 'J'])
    expect(store().game?.current).toBe(0)
    expect(store().handoff).toBeNull()
    // 3. only now does play pass on
    vi.advanceTimersByTime(growMs - 1)
    expect(store().handoff).toBeNull()
    vi.advanceTimersByTime(1)
    expect(store().refreshFx).toBeNull()
    expect(store().game?.phase).toBe('play')
    expect(store().game?.current).toBe(1)
    expect(store().handoff).toEqual({ seat: 1, afterGrow: false })
    expect(store().trayOrder[0].map((i) => store().game!.hands[0][i])).toEqual(['V', 'W', 'C', 'X', 'F', 'G', 'H', 'J'])
  })

  it('nothing can be touched while it plays', () => {
    yellowRefreshing()
    store().tapSeed(0)
    store().refresh()
    store().tapSeed(3) // would set another seed aside
    store().refresh(true)
    expect(store().setAside).toEqual([0])
    expect(store().refuseTap({ glyph: 1 })).toBe(false) // quiet — no "no" shake either
    vi.runAllTimers()
    expect(store().game?.hands[0]).toHaveLength(8)
  })

  it('Keep all: no animation, straight on', () => {
    yellowRefreshing()
    store().refresh(true)
    expect(store().refreshFx).toBeNull()
    expect(store().game?.current).toBe(1)
  })

  it('leaving mid-refresh stops it (nothing happens to the next game)', () => {
    yellowRefreshing()
    store().tapSeed(0)
    store().refresh()
    store().leaveGame()
    vi.runAllTimers()
    expect(store().game).toBeNull()
    expect(store().refreshFx).toBeNull()
  })
})
