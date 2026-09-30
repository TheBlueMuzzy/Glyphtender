// Which glyphlings pulse at the start of a turn (whose turn it is, on this device, until a move is planned).
import { beforeEach, describe, expect, it } from 'vitest'
import { getBoard } from '../engine/boards'
import { legalDraftHexes } from '../engine/engine'
import { DIRECTIONS, addHex } from '../engine/hex'
import { hexAt, position, wordsOf } from '../engine/testkit'
import { useGameStore } from './gameStore'
import { pulsingGlyphlings } from './turnPulse'

const store = () => useGameStore.getState()
const pulsing = () => pulsingGlyphlings(store())

/** Seeds on every hex next to `label` (so a glyphling there can't move: tangled). */
function boxIn(label: string): Record<string, string> {
  const board = getBoard('small')
  const centre = hexAt(label)
  return Object.fromEntries(DIRECTIONS.map((d) => addHex(centre, d)).filter(board.has).map((h) => [board.label(h), 'A']))
}

/** Yellow to play: glyphling 0 can move; glyphling 1 in the corner C1-1 is boxed in by seeds (tangled). */
function yellowToPlay() {
  store().loadState(position({
    glyphlings: { 0: 'C6-7', 1: 'C1-1', 2: 'C11-1', 3: 'C11-4' },
    seeds: [boxIn('C1-1')],
    hands: [['T'], ['E']],
    bag: ['X'],
  }))
}

beforeEach(() => {
  store().leaveGame()
  store().setWords(wordsOf('AT'))
})

describe('turn pulse', () => {
  it('the current player’s glyphlings that can move pulse — a tangled one doesn’t, nor the other player’s', () => {
    yellowToPlay()
    expect(pulsing()).toEqual([0])
  })

  it('stops once a move is planned, comes back when it’s undone; the held glyphling doesn’t pulse while held', () => {
    yellowToPlay()
    store().tapGlyphling(0)
    expect(pulsing()).toEqual([]) // held: its ring shows instead
    store().tapHex(hexAt('C6-6'))
    expect(pulsing()).toEqual([])
    store().undo()
    expect(pulsing()).toEqual([0])
  })

  it('never in the draft, while a seed flies, or while the device is being passed on', () => {
    store().startGame({ players: 2, seed: 7, hideSeeds: true })
    expect(pulsing()).toEqual([])
    while (store().game!.phase === 'draft') store().tapHex(legalDraftHexes(store().game!)[0])
    expect(store().handoff).not.toBeNull()
    expect(pulsing()).toEqual([])
    store().showSeeds()
    expect(pulsing().length).toBeGreaterThan(0)
    useGameStore.setState({ flying: true })
    expect(pulsing()).toEqual([])
  })

  it('online: only on my own turn', () => {
    yellowToPlay()
    useGameStore.setState({ seats: [{ kind: 'online', name: 'Bo', colour: 'yellow' }, { kind: 'local', name: 'Me', colour: 'blue' }] })
    expect(pulsing()).toEqual([]) // Yellow is on another device
  })
})
