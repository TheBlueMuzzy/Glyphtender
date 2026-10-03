import { describe, expect, it } from 'vitest'
import { applyAction } from './engine'
import { hexKey } from './hex'
import { reachArea, seedsFlownOver, turnMobility } from './insight'
import { logOf } from './log'
import { blockedSpot } from './turn'
import { hexAt, position, wordsOf } from './testkit'

const words = wordsOf('CAT', 'AT', 'TO')
const turn = (glyphling: number, to: string, target: string | null) =>
  ({ type: 'turn' as const, glyphling, to: hexAt(to), seed: target ? 0 : null, target: target ? hexAt(target) : null })

describe('what a turn did to the board (insight.ts → the game log)', () => {
  // Blue's glyphling 2 sits in the C11-1 corner with its own seeds S and NW of it: only the long SW leyline is open
  // (C10-3 … C2-7, 9 hexes). Yellow steps into that line at C8-5 (→ 2 moves left), then casts onto C10-3 (→ 0).
  const squeeze = position({
    glyphlings: { 0: 'C8-8', 1: 'C1-4', 2: 'C11-1', 3: 'C3-2' },
    seeds: [{}, { 'C11-2': 'E', 'C10-2': 'E' }],
    hands: [['Z'], ['E']], bag: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  })

  it('mobility: every glyphling’s legal moves before the move, after it, after the cast', () => {
    const next = applyAction(squeeze, turn(0, 'C8-5', 'C10-3'), words)
    const done = next.phase === 'refresh' ? applyAction(next, { type: 'refresh', setAside: [] }, words) : next
    const [t] = logOf(done).turns
    expect(t.mobility!.before[2]).toBe(9)
    expect(t.mobility!.afterMove[2]).toBe(2)
    expect(t.mobility!.afterCast[2]).toBe(0)
    expect(t.mobility!.before).toHaveLength(4)
  })

  it('turnMobility rebuilds the earlier boards from the board after the cast', () => {
    const after = applyAction(squeeze, turn(0, 'C8-5', 'C10-3'), words)
    expect(turnMobility(after, 0, hexAt('C8-8'), hexAt('C10-3'))).toMatchObject({ before: expect.arrayContaining([9]), afterCast: expect.arrayContaining([0]) })
    // a move-only turn: after the move = after the cast
    const m = turnMobility(after, 0, hexAt('C8-8'), null)
    expect(m.afterMove).toEqual(m.afterCast)
  })

  it('castOver: the caster’s own seeds the shot flew over (anyone else’s can’t be flown over at all)', () => {
    const s = position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C6-5': 'A', 'C6-4': 'B' }, {}], hands: [['T'], []],
    })
    const after = applyAction(s, turn(0, 'C6-6', 'C6-2'), words)
    expect(seedsFlownOver(after, 0, hexAt('C6-6'), hexAt('C6-2'))).toBe(2)
    expect(seedsFlownOver(after, 0, hexAt('C6-6'), null)).toBe(0)
    expect(logOf(after.phase === 'refresh' ? applyAction(after, { type: 'refresh', setAside: [] }, words) : after).turns[0].castOver).toBe(2)
  })

  // Yellow's seeds wall off the C1-1/C1-2 corner except C1-3; Yellow steps to C1-2 and casts onto C1-3: sealed.
  const corner = position({
    glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C11-1', 3: 'C11-4' },
    seeds: [{ 'C2-2': 'A', 'C2-3': 'B', 'C2-4': 'C' }, {}],
    hands: [['T'], []], bag: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  })

  it('a garden: every hex a glyphling could ever walk to — seeds are walls, glyphlings aren’t (Walled garden, stats.ts)', () => {
    const walled = applyAction(corner, turn(0, 'C1-2', 'C1-3'), words)
    expect([...reachArea(walled, hexAt('C1-2'))].sort()).toEqual([hexKey(hexAt('C1-1')), hexKey(hexAt('C1-2'))].sort())
    expect(reachArea(corner, hexAt('C11-1')).has(hexKey(hexAt('C11-4')))).toBe(true)
  })
})

describe('a spot a rival could have scored on (turn.ts blockedSpot → the log’s Weed toss facts)', () => {
  // Yellow's C and A run down column 6; Blue holds a T and can step to C6-7 and shoot up the column onto C6-4: CAT.
  const plan = (blueHand: string[]) => position({
    glyphlings: { 0: 'C5-7', 1: 'C1-4', 2: 'C6-8', 3: 'C11-4' },
    seeds: [{ 'C6-2': 'C', 'C6-3': 'A' }, {}],
    hands: [['Z'], blueHand], bag: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  })
  const play = (blueHand: string[]) => {
    const after = applyAction(plan(blueHand), turn(0, 'C5-5', 'C6-4'), words) // Yellow's junk Z onto C6-4
    return { after, logged: logOf(applyAction(after, { type: 'refresh', setAside: [] }, words)).turns[0] }
  }

  it('Yellow’s junk Z took the hex where Blue’s T would have made CAT (+4: 3 letters + 1 own seed)', () => {
    const { after, logged } = play(['T', 'Q'])
    expect(blockedSpot(after, 0, hexAt('C6-4'), words)).toEqual({ seat: 1, magic: 4, word: 'CAT' })
    expect(logged.blocked).toEqual({ seat: 1, magic: 4, word: 'CAT' })
  })
  it('nothing blocked when the rival had no letter that grows a word there', () => {
    expect(play(['Q', 'X']).logged.blocked).toBeNull()
  })
  it('the pending fact never outlives its turn', () => {
    const { after } = play(['T'])
    expect(after.pendingLog?.blocked).toBeTruthy() // waiting for the refresh…
    expect(applyAction(after, { type: 'refresh', setAside: [] }, words).pendingLog).toBeNull() // …then into the log
  })
})
