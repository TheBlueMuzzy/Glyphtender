import { describe, expect, it } from 'vitest'
import { getBoard } from './boards'
import { applyAction, legalDraftHexes, legalMoves } from './engine'
import { hexKey, neighbours } from './hex'
import { logOf } from './log'
import { randomAction } from './sim'
import { newGame } from './setup'
import { hexAt, position, wordsOf } from './testkit'
import type { GameState } from './types'

const words = wordsOf('AT', 'CAT', 'TO', 'QUIT', 'EAT', 'TEA', 'ATE', 'NET', 'TEN', 'IN', 'IT', 'ON', 'NO', 'AN')

describe('the game log (log.ts)', () => {
  it('a new game starts with an empty log', () => {
    expect(newGame({ players: 2, seed: 1 }).log).toEqual({ turns: [], end: null })
  })

  it('a word turn: letters, the owner of each seed, Magic and own Magic, everyone’s totals after', () => {
    // Yellow's C on C6-2, Blue's A on C6-3 and O on C7-4; Yellow casts T on C6-4 → CAT + TO
    const s = position({
      glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C6-2': 'C' }, { 'C6-3': 'A', 'C7-4': 'O' }],
      hands: [['T'], ['E']], bag: ['X'],
    })
    const next = applyAction({ ...s, magic: [4, 9] }, { type: 'turn', glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }, words)
    const [turn] = logOf(next).turns
    expect(turn).toMatchObject({ turnNo: 1, round: 1, seat: 0, glyphlingId: 0, letter: 'T', magic: 8, refreshed: 0, refresh: false })
    const cat = turn.words.find((w) => w.word === 'CAT')!
    expect(cat).toMatchObject({ word: 'CAT', letters: ['C', 'A', 'T'], owners: [0, 1, 0], magic: 5, ownMagic: 2, at: 2 })
    expect(cat.hexes).toEqual(['C6-2', 'C6-3', 'C6-4'].map((l) => hexKey(hexAt(l))))
    expect(turn.words.find((w) => w.word === 'TO')).toMatchObject({ owners: [0, 1], magic: 3, ownMagic: 1 })
    expect(turn.totalsAfter).toEqual([12, 9])
  })

  it('Qu is one seed in the letters', () => {
    const s = position({ glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, seeds: [{ 'C6-2': 'Qu', 'C6-3': 'I' }], hands: [['T'], []] })
    const next = applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }, words)
    expect(logOf(next).turns[0].words[0]).toMatchObject({ word: 'QUIT', letters: ['Qu', 'I', 'T'], owners: [0, 0, 0], ownMagic: 3 })
  })

  it('a refresh is logged once, on the refresh, with how many seeds were set aside', () => {
    const s = position({ glyphlings: { 0: 'C6-7', 1: 'C1-4', 2: 'C11-1', 3: 'C11-4' }, hands: [['Z', 'C', 'F'], ['E']], bag: ['A', 'B', 'D', 'E', 'G', 'H', 'I'] })
    const cast = applyAction(s, { type: 'turn', glyphling: 0, to: hexAt('C6-6'), seed: 0, target: hexAt('C6-4') }, words)
    expect(cast.phase).toBe('refresh')
    expect(logOf(cast).turns).toEqual([]) // not finished yet
    const done = applyAction(cast, { type: 'refresh', setAside: [0, 1] }, words)
    expect(logOf(done).turns).toHaveLength(1)
    expect(logOf(done).turns[0]).toMatchObject({ refreshed: 2, refresh: true, magic: 0, words: [] })
    const keepAll = applyAction(cast, { type: 'refresh', setAside: [] }, words)
    expect(logOf(keepAll).turns[0]).toMatchObject({ refreshed: 0, refresh: true })
  })

  it('the game-ending turn: who ended it, a self-tangle, each tangle’s bonus, final totals', () => {
    // Yellow's glyphling 0 in the C1-1 corner, Blue's 2 hemmed in at C11-1; Yellow tangles its own glyphling 0
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C11-1', 3: 'C6-5' },
      seeds: [{ 'C10-2': 'A', 'C10-3': 'B' }, { 'C2-2': 'C', 'C2-3': 'D', 'C11-2': 'E' }],
      hands: [['S'], ['T']],
    })
    const before: GameState = { ...s, tangled: [2], magic: [2, 5] }
    const next = applyAction(before, { type: 'turn', glyphling: 1, to: hexAt('C1-3'), seed: 0, target: hexAt('C1-2') }, words)
    const log = logOf(next)
    const last = log.turns.at(-1)!
    expect(last.newlyTangled).toEqual([0])
    expect(last.tangledAfter.sort()).toEqual([0, 2])
    expect(last.totalsAfter).toEqual([2, 5]) // before the tangle bonus
    expect(log.end).toMatchObject({ endedOnTurn: 1, endedBy: 0, selfTangle: true, tangleMagic: [6, 6], totals: [8, 11] })
    expect(log.end!.tangles.find((t) => t.glyphling === 0)).toEqual({ glyphling: 0, owner: 0, pieces: [0, 2], bonus: [0, 6] })
    expect(log.end!.tangles.find((t) => t.glyphling === 2)).toEqual({ glyphling: 2, owner: 1, pieces: [2, 0], bonus: [6, 0] })
  })

  it('a glyphling that comes free is logged as freed', () => {
    const s = position({ glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C1-2', 3: 'C8-5' }, seeds: [{}, { 'C2-2': 'C', 'C2-3': 'D' }], hands: [['S'], ['T']] })
    const a = applyAction(s, { type: 'turn', glyphling: 1, to: hexAt('C6-4'), seed: 0, target: hexAt('C6-5') }, words)
    const b = applyAction(a, { type: 'turn', glyphling: 2, to: hexAt('C1-4'), seed: 0, target: hexAt('C1-3') }, words)
    expect(logOf(b).turns.map((t) => [t.newlyTangled, t.freed])).toEqual([[[0], []], [[], [0]]])
    expect(logOf(b).turns.map((t) => t.round)).toEqual([1, 1])
  })

  for (const players of [2, 3, 4]) {
    it(`${players} players, whole random games: one entry per turn, rounds in order, totals add up`, () => {
      for (const seed of [1, 2, 3]) {
        let state = newGame({ players, seed })
        let rng = seed
        while (state.phase !== 'over') {
          const pick = randomAction(state, rng)
          rng = pick.rng
          state = applyAction(state, pick.action, words)
        }
        const log = logOf(state)
        expect(log.turns).toHaveLength(state.turnCount)
        expect(log.turns.map((t) => t.turnNo)).toEqual(log.turns.map((_, i) => i + 1))
        log.turns.forEach((t, i) => {
          if (i === 0) return expect(t.round).toBe(1)
          const prev = log.turns[i - 1]
          expect(t.round).toBe(t.seat <= prev.seat ? prev.round + 1 : prev.round)
          // each turn adds exactly its Magic to its own seat
          expect(t.totalsAfter.map((m, seat) => m - prev.totalsAfter[seat])).toEqual(t.totalsAfter.map((_, seat) => (seat === t.seat ? t.magic : 0)))
          expect(t.words.reduce((sum, w) => sum + w.magic, 0)).toBe(t.magic)
        })
        const last = log.turns.at(-1)!
        expect(log.end!.totals).toEqual(state.magic)
        expect(last.totalsAfter.map((m, seat) => m + state.tangleMagic[seat])).toEqual(state.magic)
        expect(log.end!.tangles.map((t) => t.glyphling).sort()).toEqual([...state.tangled].sort())
        expect(JSON.parse(JSON.stringify(state.log))).toEqual(state.log) // plain data
      }
    })
  }

  it('a glyphling already stuck when the draft ends is not credited to the first turn (only that turn’s tangles count)', () => {
    // A hand-built draft (Dev Kit / test positions can put seeds down first): glyphling 0 boxed in by seeds,
    // and seat 0's second glyphling still to place — the last placement of a 2-player snake draft
    const board = getBoard('small')
    const boxed = hexAt('C6-7')
    const ring = Object.fromEntries(neighbours(board, boxed).map((h) => [board.label(h), 'E']))
    const s = position({ glyphlings: { 0: 'C6-7', 2: 'C11-1', 3: 'C11-4' }, seeds: [ring] })
    const draft: GameState = { ...s, phase: 'draft', draftIndex: s.draftOrder.length - 1, current: s.draftOrder.at(-1)! }
    expect(draft.current).toBe(0)
    const placed = applyAction(draft, { type: 'draft', hex: legalDraftHexes(draft)[0] }, words)
    expect(placed.phase).toBe('play')
    expect(placed.tangled).toEqual([0]) // stuck from the start of play
    const mover = placed.glyphlings.find((g) => g.seat === 0 && g.id !== 0)!
    const next = applyAction(placed, { type: 'turn', glyphling: mover.id, to: legalMoves(placed, mover.id)[0], seed: null, target: null }, words)
    const [turn] = logOf(next).turns
    expect(turn.tangledAfter).toContain(0)
    expect(turn.newlyTangled).not.toContain(0)
  })
})

// A COMPLETE TANGLE (Muzzy, 2026-10-02): an opponent's glyphling that, the moment it got tangled, had ONLY your
// seeds or glyphlings next to it (your glyphlings count as your tiles). The board's edge doesn't count either way;
// another player's seed or glyphling (or the owner's own) spoils it.
// C1-1 is a corner of the small board: its only neighbours are C1-2, C2-2 and C2-3.
describe('complete tangles in the log', () => {
  /** Blue's glyphling 3 steps C1-4 → C1-3 and casts into C1-2, the last open hex next to Yellow's glyphling 0. */
  const blueCloses = { type: 'turn' as const, glyphling: 3, to: hexAt('C1-3'), seed: 0, target: hexAt('C1-2') }
  const corner = (seeds: Record<string, string>[], extra: Record<number, string> = {}, players = 2) => position({
    players, current: 1,
    glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C6-8', 3: 'C1-4', ...extra },
    seeds, hands: Array.from({ length: players }, () => ['S']),
  })
  const completes = (s: GameState) => logOf(applyAction(s, blueCloses, words)).turns[0].completeTangles

  it('only Blue seeds next to it (the corner: the board edge is ignored) → Blue completed it', () => {
    expect(completes(corner([{}, { 'C2-2': 'A', 'C2-3': 'B' }]))).toEqual([{ glyphling: 0, by: 1 }])
  })
  it("one other player's seed next to it → nobody", () => {
    expect(completes(corner([{}, { 'C2-2': 'A' }, { 'C2-3': 'B' }], { 4: 'C9-4', 5: 'C9-6' }, 3))).toEqual([{ glyphling: 0, by: null }])
  })
  it("the owner's own seed next to it → nobody", () => {
    expect(completes(corner([{ 'C2-3': 'B' }, { 'C2-2': 'A' }]))).toEqual([{ glyphling: 0, by: null }])
  })
  it("the closer's own glyphling next to it counts as theirs (Muzzy: your glyphlings count as your tiles) → Blue completed it", () => {
    expect(completes(corner([{}, { 'C2-2': 'A' }], { 2: 'C2-3' }))).toEqual([{ glyphling: 0, by: 1 }])
  })
  it("another player's glyphling next to it → nobody", () => {
    expect(completes(corner([{}, { 'C2-2': 'A' }, {}], { 4: 'C2-3', 5: 'C9-6' }, 3))).toEqual([{ glyphling: 0, by: null }])
  })
  it("the owner's own other glyphling next to it → nobody", () => {
    expect(completes(corner([{}, { 'C2-2': 'A' }], { 1: 'C2-3' }))).toEqual([{ glyphling: 0, by: null }])
  })
  it('a glyphling hemmed in by its OWNER’s seeds only is never complete', () => {
    // Yellow's own seeds all round it, then Yellow's own cast closes it
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C1-4', 2: 'C6-5', 3: 'C6-8' },
      seeds: [{ 'C2-2': 'A', 'C2-3': 'B' }, {}], hands: [['S'], ['S']],
    })
    const next = applyAction(s, { type: 'turn', glyphling: 1, to: hexAt('C1-3'), seed: 0, target: hexAt('C1-2') }, words)
    expect(logOf(next).turns[0].completeTangles).toEqual([{ glyphling: 0, by: null }])
  })
  it('two players complete one each in one game; nothing logged on turns with no new tangle', () => {
    const s = position({
      glyphlings: { 0: 'C1-1', 1: 'C11-4', 2: 'C11-1', 3: 'C1-4' },
      seeds: [{ 'C10-2': 'A', 'C10-3': 'B' }, { 'C2-2': 'C', 'C2-3': 'D' }], hands: [['S'], ['T']],
    })
    const one = applyAction(s, { type: 'turn', glyphling: 1, to: hexAt('C11-3'), seed: 0, target: hexAt('C11-2') }, words)
    expect(one.phase).toBe('play')
    const two = applyAction(one, blueCloses, words)
    expect(two.phase).toBe('over')
    expect(logOf(two).turns.map((t) => t.completeTangles)).toEqual([[{ glyphling: 2, by: 0 }], [{ glyphling: 0, by: 1 }]])
  })
})
