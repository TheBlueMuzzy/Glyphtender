// Turn trails: which trail the board shows (plan / live — nothing once a turn has landed) and its from → to → target.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { useGameStore } from './gameStore'
import { boardTrail, trailKey, trailOf } from './trail'

const store = () => useGameStore.getState()
const shown = () => boardTrail(store())

/** Yellow to play: glyphling 0 at C6-7 (can move up to C6-6 and cast onto C6-4). */
function yellowToPlay() {
  store().loadState(position({
    glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
    hands: [['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K'], ['E']],
    bag: ['V', 'W', 'X', 'Y', 'Z'],
  }))
}

/** Yellow moves glyphling 0 up to C6-6 and aims its first seed at C6-4. */
function planYellowTurn() {
  store().tapGlyphling(0)
  store().tapHex(hexAt('C6-6'))
  store().tapSeed(0)
  store().tapHex(hexAt('C6-4'))
}

beforeEach(() => {
  store().leaveGame()
  store().setWords(wordsOf('AT', 'TA'))
})

describe('turn trails', () => {
  it('a finished turn becomes its trail: whose, which glyphling, from, to and the cast target', () => {
    expect(trailOf(null)).toBeNull()
    const turn = { seat: 1, glyphlingId: 3, from: hexAt('C4-4'), to: hexAt('C4-2'), letter: 'Q', target: hexAt('C6-3'), words: [], magic: 0, drew: 0 }
    expect(trailOf(turn)).toEqual({ seat: 1, glyphlingId: 3, from: hexAt('C4-4'), to: hexAt('C4-2'), target: hexAt('C6-3') })
    expect(trailOf({ ...turn, letter: null, target: null })?.target).toBeNull() // a move-only turn: no arc
  })

  it('the key names the turn (another turn gets a new one)', () => {
    const a = { seat: 0, glyphlingId: 0, from: hexAt('C6-7'), to: hexAt('C6-6'), target: hexAt('C6-4') }
    expect(trailKey(a)).toBe(trailKey({ ...a }))
    expect(trailKey(a)).not.toBe(trailKey({ ...a, target: null }))
    expect(trailKey(a)).not.toBe(trailKey({ ...a, seat: 1 }))
  })

  it('nothing before the first turn, and nothing while just holding a glyphling', () => {
    yellowToPlay()
    expect(shown()).toBeNull()
    store().tapGlyphling(0)
    expect(shown()).toBeNull()
  })

  it('planning: the trail follows MY plan in my colour — the move, then the aimed seed', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    store().tapHex(hexAt('C6-6'))
    expect(shown()).toEqual({ mode: 'plan', trail: { seat: 0, glyphlingId: 0, from: hexAt('C6-7'), to: hexAt('C6-6'), target: null } })
    store().tapSeed(0)
    store().tapHex(hexAt('C6-4'))
    expect(shown()?.trail.target).toEqual(hexAt('C6-4'))
    store().undo() // the cast comes back: just the move
    expect(shown()?.trail.target).toBeNull()
  })

  it("the trail is gone once the seed lands — nothing stays after the cast (Muzzy: shouldn't stick around post cast)", () => {
    yellowToPlay()
    planYellowTurn()
    store().startCast()
    expect(shown()?.mode).toBe('plan') // while the seed flies, the planned path is still there
    store().finishCast()
    expect(shown()).toBeNull() // landed: no trail
    expect(store().game!.phase).toBe('refresh') // no word: Yellow may refresh first
    vi.useFakeTimers()
    store().refresh(true)
    vi.advanceTimersByTime(5000)
    vi.useRealTimers()
    store().showSeeds() // the handoff (pass-and-play): no old trail on the next player's board
    expect(store().game!.current).toBe(1)
    expect(store().game!.lastTurn).not.toBeNull()
    expect(shown()).toBeNull()
  })

  it('a replayed turn (online) shows live, over any plan, until the store clears it', () => {
    yellowToPlay()
    const replayed = { seat: 1, glyphlingId: 2, from: hexAt('C11-1'), to: hexAt('C10-1'), target: null }
    useGameStore.setState({ trail: replayed, move: { glyphling: 2, to: hexAt('C10-1') } }) // the glide is on
    expect(shown()).toEqual({ mode: 'live', trail: replayed })
    useGameStore.setState({ trail: null, move: null })
    expect(shown()).toBeNull() // (no lastTurn in this position)
  })

  it('no trail in the draft or at the end (the reveal owns the garden)', () => {
    store().startGame({ players: 2, seed: 7 })
    expect(shown()).toBeNull()
    yellowToPlay()
    const replayed = { seat: 1, glyphlingId: 2, from: hexAt('C11-1'), to: hexAt('C10-1'), target: null }
    useGameStore.setState({ trail: replayed, game: { ...store().game!, phase: 'over' } })
    expect(shown()).toBeNull()
  })
})
