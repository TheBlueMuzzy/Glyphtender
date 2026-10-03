import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyAction } from '../engine/engine'
import { randomAction } from '../engine/sim'
import { newGame } from '../engine/setup'
import { winnersOf } from '../engine/tangle'
import type { GameState, LogTurn } from '../engine/types'
import endscreen from '../../content/tuning/endscreen.json'
import { logIsComplete } from '../engine/log'
import { hexAt, position } from '../engine/testkit'
import { awardPoint, earnedAwards, scorecards, standings, storyChart } from './stats'

// ─── Hand-built logs ───
// A turn: [seat, words as "WORD:owners" (owners = one digit per seed, e.g. "CAT:010"), extra fields]
type TurnPlan = [number, string[], Partial<LogTurn>?]
const OWN = 1 // ownershipBonus

/** A finished game whose log is exactly these turns (rounds follow seat order; Magic = letters + 1 per own seed). */
function finished(players: number, plan: TurnPlan[], end: { tangled?: [number, number][]; tangleMagic?: number[]; selfTangle?: boolean } = {}): GameState {
  const base = newGame({ players, seed: 1 })
  const totals = Array(players).fill(0)
  const turns: LogTurn[] = []
  plan.forEach(([seat, words, extra], i) => {
    const made = words.map((spec) => {
      const [word, owners] = spec.split(':')
      const own = [...owners].map(Number)
      const ownMagic = own.filter((o) => o === seat).length * OWN
      return { word, letters: [...word], owners: own, magic: word.length + ownMagic, ownMagic }
    })
    const magic = made.reduce((sum, w) => sum + w.magic, 0)
    totals[seat] += magic
    const prev = turns.at(-1)
    const round = !prev ? 1 : seat <= prev.seat ? prev.round + 1 : prev.round
    turns.push({
      turnNo: i + 1, round, seat, glyphlingId: seat * 2, from: { q: 0, r: 0 }, to: { q: 0, r: 1 }, letter: 'A', target: null,
      words: made, magic, refreshed: 0, refresh: false, totalsAfter: [...totals], tangledAfter: [], newlyTangled: [], freed: [], ...extra,
    })
  })
  const tangleMagic = end.tangleMagic ?? Array(players).fill(0)
  const magic = totals.map((m, seat) => m + tangleMagic[seat])
  const tangled = (end.tangled ?? []).map(([id]) => id)
  // [glyphling, turnNo that tangled it]
  for (const [id, turnNo] of end.tangled ?? []) turns[turnNo - 1].newlyTangled.push(id)
  const last = turns.at(-1)!
  return {
    ...base, phase: 'over', magic, tangleMagic, winners: winnersOf(magic), tangled, turnCount: turns.length,
    glyphlings: Array.from({ length: players * 2 }, (_, id) => ({ id, seat: Math.floor(id / 2), hex: { q: id, r: 0 } })),
    log: { turns, end: { endedOnTurn: last.turnNo, endedBy: last.seat, selfTangle: end.selfTangle ?? false, tangles: [], tangleMagic, totals: magic } },
  }
}

describe('standings', () => {
  it('best first; equal Magic shares a place and the next place skips', () => {
    const g = { ...newGame({ players: 4, seed: 1 }), magic: [10, 30, 20, 20] }
    expect(standings(g).map((s) => [s.seat, s.place, s.tied])).toEqual([[1, 1, false], [2, 2, true], [3, 2, true], [0, 4, false]])
  })
  it('a shared win', () => {
    const g = { ...newGame({ players: 2, seed: 1 }), magic: [12, 12] }
    expect(standings(g).map((s) => s.place)).toEqual([1, 1])
  })
})

describe('scorecards', () => {
  const g = finished(2, [
    [0, ['CAT:000']], //            solo, 3 letters: 6
    [1, ['TO:01', 'AT:11']], //      2 words: TO 3 (borrowed T), AT 4 (solo)
    [0, ['GARDEN:001110']], //       6 letters, 3 own: 9
    [1, [], { refresh: true, refreshed: 3 }],
    [0, ['TEAS:0000', 'ADS:010']], // 8 + 5
  ], { tangled: [[2, 5], [0, 4]], tangleMagic: [6, 3] })
  const [y, b] = scorecards(g)

  it('Magic from words, solo words and tangles add up to the total', () => {
    expect(y).toMatchObject({ wordMagic: 28, soloMagic: 14, tangleMagic: 6, total: 34 })
    expect(b).toMatchObject({ wordMagic: 7, soloMagic: 4, tangleMagic: 3, total: 10 })
  })
  it('words by length 2/3/4/5/6+, longest, best word, best turn, multi-word turns', () => {
    expect(y.byLength).toEqual([0, 2, 1, 0, 1])
    expect(b.byLength).toEqual([2, 0, 0, 0, 0])
    expect(y.longestWord).toBe('GARDEN')
    expect(y.bestWord).toEqual({ word: 'GARDEN', magic: 9 })
    expect(y.bestTurn).toEqual({ magic: 13, words: ['TEAS', 'ADS'], turnNo: 5 })
    expect([y.multiWordTurns, b.multiWordTurns]).toEqual([1, 1])
    expect(y.wordsMade).toBe(4)
  })
  it('seeds refreshed, letters borrowed and given', () => {
    expect(b.seedsRefreshed).toBe(3)
    expect([y.lettersBorrowed, y.lettersGiven, b.lettersBorrowed, b.lettersGiven]).toEqual([4, 1, 1, 4])
  })
  it('complete tangles: counted from the log, per player who completed them', () => {
    const done = finished(3, [
      [0, [], { newlyTangled: [], completeTangles: [] }],
      [1, [], { completeTangles: [{ glyphling: 0, by: 1 }, { glyphling: 4, by: null }] }],
      [2, [], { completeTangles: [] }],
      [0, [], { completeTangles: [{ glyphling: 2, by: 0 }] }],
      [1, [], { completeTangles: [{ glyphling: 5, by: 1 }] }],
    ])
    expect(scorecards(done).map((c) => c.completeTangles)).toEqual([1, 2, 0])
  })
  it('complete tangles from a log written before they were recorded: unknown (null), never a guess', () => {
    expect(scorecards(g).map((c) => c.completeTangles)).toEqual([null, null])
    const old = { ...newGame({ players: 2, seed: 1 }), magic: [5, 6], log: undefined }
    expect(scorecards(old).map((c) => c.completeTangles)).toEqual([null, null])
  })
  it('a game without a log (an old snapshot) gives empty cards, not a crash', () => {
    const old = { ...newGame({ players: 3, seed: 1 }), magic: [5, 6, 7], log: undefined }
    expect(scorecards(old).map((c) => [c.total, c.wordsMade, c.bestTurn])).toEqual([[5, 0, null], [6, 0, null], [7, 0, null]])
    expect(earnedAwards(old)).toEqual([])
    expect(storyChart(old, 6).series[2].points).toEqual([0, 7])
  })
})

describe('awards (skill, earned only)', () => {
  // Fixed test thresholds (the real ones in endscreen.json are provisional and will be re-tuned)
  const T = {
    ...endscreen, lockdownMinDrop: 5, lockdownMaxAfter: 2, pincerMinFrom: 6, pincerMinEach: 2, pincerMaxLeft: 0.5, weedMaxMagic: 0, weedMinBlocked: 6,
    weedMinCut: 4, walledMinMagic: 12, walledMaxSize: 40, hedgeMinOver: 2, powerPlayMin: 3, longWordMinSmall: 6, longWordMinLarge: 6,
    hijackMinFrom: 3, bridgeMinSide: 2, closeCallMinAfter: 4, tricksterMinBehind: 1, calledItMinLead: 1,
  }
  /** Mobility for 2 players (4 glyphlings): everyone has 8 moves, except the changes asked for (id → [before, afterMove, afterCast]). */
  const mob = (changes: Record<number, [number, number, number]> = {}, count = 4) => {
    const m = { before: Array(count).fill(8), afterMove: Array(count).fill(8), afterCast: Array(count).fill(8) }
    for (const [id, [a, b, c]] of Object.entries(changes)) { m.before[+id] = a; m.afterMove[+id] = b; m.afterCast[+id] = c }
    return m
  }
  const ids = (g: GameState, tuning = T) => earnedAwards(g, tuning).map((a) => `${a.id}:${a.holder}`)
  const one = (g: GameState, id: string) => earnedAwards(g, T).find((a) => a.id === id)

  it('nothing earned → no awards at all (the Highlights area hides)', () => {
    expect(earnedAwards(finished(2, [[0, ['AT:00']], [1, ['TO:11']], [0, [], { mobility: mob() }]]), T)).toEqual([])
  })

  it('Lockdown: one turn took a rival glyphling from many moves to almost none — with the proof', () => {
    const g = finished(2, [[0, ['AT:00'], { mobility: mob({ 2: [9, 5, 2] }) }], [1, ['TO:11']]])
    expect(one(g, 'lockdown')).toMatchObject({ holder: 0, seats: [0, 1], moment: 1, values: { other: 1, from: 9, to: 2 } })
    // too small a drop, or too many moves left: not a lockdown
    expect(ids(finished(2, [[0, [], { mobility: mob({ 2: [6, 6, 2] }) }]]))).not.toContain('lockdown:0')
    expect(ids(finished(2, [[0, [], { mobility: mob({ 2: [12, 12, 4] }) }]]))).not.toContain('lockdown:0')
    // your own glyphling losing moves is never your lockdown
    expect(ids(finished(2, [[0, [], { mobility: mob({ 1: [9, 9, 0] }) }]]))).not.toContain('lockdown:0')
  })

  it('Pincer: the move AND the cast each cut the same rival glyphling', () => {
    const g = finished(2, [[0, [], { mobility: mob({ 3: [8, 5, 2] }) }]])
    expect(one(g, 'pincer')).toMatchObject({ holder: 0, values: { from: 8, to: 2 } })
    // both cut, but it still has more than half its moves left: no pincer
    expect(ids(finished(2, [[0, [], { mobility: mob({ 3: [12, 10, 7] }) }]]))).not.toContain('pincer:0')
    // already cornered (fewer than pincerMinFrom moves): no pincer
    expect(ids(finished(2, [[0, [], { mobility: mob({ 3: [5, 3, 1] }) }]]))).not.toContain('pincer:0')
    // only the cast cut it (or only the move): no pincer
    expect(ids(finished(2, [[0, [], { mobility: mob({ 3: [8, 8, 2] }) }]]))).not.toContain('pincer:0')
    expect(ids(finished(2, [[0, [], { mobility: mob({ 3: [8, 2, 2] }) }]]))).not.toContain('pincer:0')
    // two DIFFERENT glyphlings each cut once: no pincer
    expect(ids(finished(2, [[0, [], { mobility: mob({ 2: [8, 4, 4], 3: [8, 8, 4] }) }]]))).not.toContain('pincer:0')
  })

  it('Weed toss: a junk cast that took a rival’s scoring spot (bonus: refreshed after), or cut their moves', () => {
    const block = { seat: 1, magic: 9, word: 'GARDEN' }
    const g = finished(2, [[0, [], { mobility: mob(), blocked: block, target: { q: 1, r: 1 }, refresh: true, refreshed: 3 }]])
    expect(one(g, 'weedToss')).toMatchObject({ holder: 0, values: { kind: 'block', other: 1, n: 9, word: 'GARDEN', refreshed: true } })
    const cutPlan = (refreshed: number): TurnPlan[] => [[0, [], { mobility: mob({ 2: [8, 7, 2] }), blocked: null, target: { q: 1, r: 1 }, refresh: true, refreshed }]]
    expect(one(finished(2, cutPlan(2)), 'weedToss')).toMatchObject({ values: { kind: 'cut', from: 7, to: 2, refreshed: true } })
    // the cut kind needs the refresh after it too (Muzzy: "to block someone so you can also intentionally refresh")
    expect(ids(finished(2, cutPlan(0)))).not.toContain('weedToss:0')
    // the cast scored: not junk. A small spot, or no cast: nothing.
    expect(ids(finished(2, [[0, ['AT:00'], { mobility: mob(), blocked: block, target: { q: 1, r: 1 } }]]))).not.toContain('weedToss:0')
    expect(ids(finished(2, [[0, [], { mobility: mob(), blocked: { ...block, magic: 2 }, target: { q: 1, r: 1 } }]]))).not.toContain('weedToss:0')
    expect(ids(finished(2, [[0, [], { mobility: mob(), blocked: block, target: null, letter: null }]]))).not.toContain('weedToss:0')
  })

  it('Walled garden: walled into a small garden no rival can reach — by anyone — then Magic made inside it', () => {
    // The small garden's C1-1 / C1-2 corner: seeds on C2-2, C2-3, C2-4, and the wall's last seed cast onto C1-3
    const board = position({
      glyphlings: { 0: 'C1-1', 1: 'C6-5', 2: 'C11-1', 3: 'C11-4' },
      seeds: [{ 'C2-2': 'A', 'C2-3': 'B', 'C2-4': 'C', 'C1-3': 'D' }, {}],
    })
    const at = (label: string) => hexAt(label)
    const blue = (from: string, to: string, words: string[], target: string | null = null): TurnPlan =>
      [0, words, { glyphlingId: 0, from: at(from), to: at(to), target: target ? at(target) : null }]
    const yellow = (target: string | null = null): TurnPlan =>
      [1, ['TO:11'], { glyphlingId: 2, from: at('C11-1'), to: at('C11-1'), target: target ? at(target) : null }]
    const game = (plan: TurnPlan[], glyphlings = board.glyphlings) => ({ ...finished(2, plan), seeds: board.seeds, glyphlings })
    const tight = { ...T, walledMaxSize: 10 }
    // Blue's own cast closes the corner (C1-3), then Blue scores in there: 4 + 14 + 8
    const own: TurnPlan[] = [
      blue('C1-1', 'C1-2', ['AT:00'], 'C1-3'), yellow(),
      blue('C1-2', 'C1-1', ['GARDENS:0000000']), yellow(),
      blue('C1-1', 'C1-2', ['CATS:0000']),
    ]
    expect(earnedAwards(game(own), tight).find((a) => a.id === 'walledGarden')).toMatchObject({ holder: 0, moment: 1, values: { n: 26 } })
    // Yellow's cast builds the wall round Blue: still Blue's Walled garden (Muzzy: "you walled me in and I STILL crushed
    // you") — counted from that turn on: 14 + 8
    const theirs: TurnPlan[] = [
      blue('C1-1', 'C1-2', ['AT:00']), yellow('C1-3'),
      blue('C1-2', 'C1-1', ['GARDENS:0000000']), yellow(),
      blue('C1-1', 'C1-2', ['CATS:0000']),
    ]
    expect(earnedAwards(game(theirs), tight).find((a) => a.id === 'walledGarden')).toMatchObject({ holder: 0, moment: 2, values: { n: 22 } })
    // a rival glyphling walled in WITH it: not a walled garden
    const shared = board.glyphlings.map((g) => (g.id === 3 ? { ...g, hex: at('C1-1') } : g))
    expect(ids(game(own, shared), tight)).not.toContain('walledGarden:0')
    // Magic made OUTSIDE the garden doesn't count; a garden bigger than walledMaxSize doesn't either
    const outside = own.map((p, i) => (i >= 2 && p[0] === 0 ? blue('C6-5', 'C6-6', p[1]) : p))
    expect(ids(game(outside), tight)).not.toContain('walledGarden:0')
    expect(ids(game(own), { ...T, walledMaxSize: 1 })).not.toContain('walledGarden:0')
  })

  it('Muzzy’s real game (2026-10-03, 0 awards before D55) earns its 5: Walled garden by a rival’s wall, hedge ×2, comeback, Pincer (12 → 9 → 5, since the halving rule)', () => {
    const real = JSON.parse(readFileSync('e2e/fixtures/muzzy-zero-awards.json', 'utf8')).state.game as GameState
    const got = earnedAwards(real)
    expect(got.map((a) => `${a.id}:${a.holder}`).sort()).toEqual(['comeback:0', 'pincer:0', 'throughHedge:0', 'throughHedge:1', 'walledGarden:0'])
    expect(got.find((a) => a.id === 'walledGarden')?.values.n).toBe(43)
  })

  it('Through the hedge: a scoring cast over 2+ of your own seeds', () => {
    expect(one(finished(2, [[0, ['CAT:000'], { castOver: 3 }]]), 'throughHedge')).toMatchObject({ values: { over: 3, n: 6 } })
    expect(ids(finished(2, [[0, ['CAT:000'], { castOver: 1 }]]))).not.toContain('throughHedge:0')
    expect(ids(finished(2, [[0, [], { castOver: 4 }]]))).not.toContain('throughHedge:0') // the shot scored nothing
  })

  it('Complete tangle: to whoever completed it (log.ts completeTangler), naming whose glyphling', () => {
    const g = finished(2, [[0, []], [1, [], { completeTangles: [{ glyphling: 0, by: 1 }] }]])
    expect(one(g, 'completeTangle')).toMatchObject({ holder: 1, seats: [1, 0], values: { other: 0 } })
    expect(ids(finished(2, [[0, [], { completeTangles: [{ glyphling: 2, by: null }] }]]))).toEqual([])
  })

  it('Power Play: 3+ words from one seed · Long word: 6+ letters', () => {
    const g = finished(2, [[0, ['AT:00', 'TO:00', 'TA:00']], [1, ['GARDENS:1111111']], [0, ['GARDEN:000000']]])
    expect(one(g, 'powerPlay')).toMatchObject({ holder: 0, values: { n: 3, words: 'AT + TO + TA' } })
    expect(earnedAwards(g, T).filter((a) => a.id === 'longWord').map((a) => [a.holder, a.values.word])).toEqual([[1, 'GARDENS'], [0, 'GARDEN']])
    expect(ids(finished(2, [[0, ['AT:00', 'TO:00']], [1, ['GARDE:11111']]])).filter((x) => /powerPlay|longWord/.test(x))).toEqual([])
  })

  it('Bridge: the seed landed inside a word, letters on both sides · Hijack: a rival’s word grown into yours', () => {
    const words = (word: string, owners: string, at: number, hexes: string[]) => {
      const own = [...owners].map(Number)
      return { word, letters: [...word], owners: own, magic: word.length, ownMagic: 0, at, hexes }
    }
    const h = (n: number) => Array.from({ length: n }, (_, i) => `0,${i}`)
    const g = finished(2, [
      [0, [], { words: [words('ART', '000', 2, h(3))], magic: 3 }],
      [1, [], { words: [words('PARTS', '11011', 0, ['0,-1', ...h(3), '0,3'])], magic: 5 }], // not a bridge: the seed is at the start
      [0, [], { words: [words('ROUND', '00100', 2, h(5))], magic: 5 }],
    ])
    expect(one(g, 'bridge')).toMatchObject({ holder: 0, values: { letter: 'U', left: 'RO', right: 'ND', word: 'ROUND' } })
    expect(earnedAwards(g, T).filter((a) => a.id === 'bridge')).toHaveLength(1)
    // Blue's PARTS holds Yellow's ART and Blue owns most of it (4 of 5)
    expect(one(g, 'hijack')).toMatchObject({ holder: 1, values: { other: 0, from: 'ART', word: 'PARTS' } })
    // owning only half isn't most; and an old log without hexes can't tell
    const half = finished(2, [[0, [], { words: [words('ART', '000', 2, h(3))] }], [1, [], { words: [words('ARTS', '0011', 3, h(4))] }]])
    expect(ids(half)).not.toContain('hijack:1')
  })

  it('Biggest comeback: the one turn that took the lead from furthest behind — once per game', () => {
    const g = finished(2, [
      [0, ['GARDENS:0000000']], // Yellow 14
      [1, ['AT:11']], //             Blue 4 (10 behind)
      [0, ['AT:00']], //             Yellow 18
      [1, ['GARDENS:1111111', 'SEA:111']], // Blue 4 + 14 + 6 = 24: was 14 behind, took the lead
    ])
    expect(earnedAwards(g, T).filter((a) => a.id === 'comeback')).toEqual([expect.objectContaining({ holder: 1, moment: 4, values: expect.objectContaining({ n: 14, gain: 20 }) })])
    // a turn that only closed the gap isn't a comeback
    expect(ids(finished(2, [[0, ['GARDENS:0000000']], [1, ['GARDEN:111111']]]))).not.toContain('comeback:1')
  })

  it('Called it (ended it while ahead, and won) · Trickster’s Victory (a rival ended it while behind → the winner)', () => {
    const ahead = finished(2, [[0, ['AT:00']], [1, ['TO:01']], [0, ['CAT:000']]]) // Yellow ends it on 10 v 3
    expect(one(ahead, 'calledIt')).toMatchObject({ holder: 0, moment: 3, values: { n: 7 } })
    const behind = finished(3, [[0, ['GARDENS:0000000']], [1, ['AT:11']], [2, ['TO:22']]]) // Purple ends it 10 behind
    expect(one(behind, 'trickster')).toMatchObject({ holder: 0, seats: [0, 2], moment: 3, values: { other: 2, n: 10 } })
    expect(ids(behind)).not.toContain('calledIt:2')
    // ahead when it ended, but the tangle bonus took the win away: no Called it
    const lost = finished(2, [[0, ['AT:00']], [1, ['TO:11']], [0, ['AT:00']]], { tangleMagic: [0, 9] })
    expect(ids(lost)).not.toContain('calledIt:0')
  })

  it('Close call: one move from tangled at the start of your turn, then plenty — and never tangled', () => {
    const g = finished(2, [[0, [], { mobility: mob({ 1: [1, 6, 6] }) }]])
    expect(one(g, 'closeCall')).toMatchObject({ holder: 0, values: { n: 6 } })
    expect(ids(finished(2, [[0, [], { mobility: mob({ 1: [1, 2, 2] }) }]]))).not.toContain('closeCall:0') // barely out
    // tangled later after all: no close call
    expect(ids(finished(2, [[0, [], { mobility: mob({ 1: [1, 6, 6] }) }], [1, []]], { tangled: [[1, 2]] }))).not.toContain('closeCall:0')
    // a rival's glyphling getting out on YOUR turn isn't your close call
    expect(ids(finished(2, [[0, [], { mobility: mob({ 2: [1, 6, 6] }) }]]))).toEqual([])
  })

  it('each award once per player (the biggest moment); several players can earn the same one; order = awardOrder', () => {
    const g = finished(2, [
      [0, [], { mobility: mob({ 2: [9, 9, 2] }) }],
      [1, [], { mobility: mob({ 0: [10, 10, 0] }) }],
      [0, [], { mobility: mob({ 3: [12, 12, 1] }) }],
    ])
    const locks = earnedAwards(g, T).filter((a) => a.id === 'lockdown')
    expect(locks.map((a) => [a.holder, a.values.from, a.values.to])).toEqual([[0, 12, 1], [1, 10, 0]]) // biggest first
    const off = { ...T, awardOrder: { ...T.awardOrder, lockdown: 0 } }
    expect(earnedAwards(g, off).some((a) => a.id === 'lockdown')).toBe(false)
    const mixed = finished(2, [[0, ['GARDENS:0000000'], { mobility: mob({ 2: [9, 9, 2] }) }]])
    expect(earnedAwards(mixed, T).map((a) => a.id)).toEqual(['lockdown', 'longWord', 'calledIt'])
  })

  it('an old log without the new facts: those awards just can’t be earned (no crash)', () => {
    const g = finished(2, [[0, ['AT:00']], [1, ['TO:11']], [0, ['CATS:0000']]])
    expect(() => earnedAwards(g, T)).not.toThrow()
    expect(ids(g)).toEqual(['calledIt:0'])
    expect(earnedAwards({ ...g, log: undefined }, T)).toEqual([])
  })

  it('the star’s spot on the Story chart: the holder’s line, the award’s round', () => {
    const g = finished(2, [[0, ['AT:00']], [1, ['TO:11']], [0, ['CAT:000'], { mobility: mob({ 2: [9, 9, 1] }) }]])
    const chart = storyChart(g, 6)
    const lock = one(g, 'lockdown')!
    expect(awardPoint(g, chart, lock)).toEqual({ kind: 'award', seat: 0, x: 2, turnNo: 3, award: 'lockdown' })
  })
})

describe('the Story chart', () => {
  const plan: TurnPlan[] = [
    [0, ['CATS:0000']], [1, ['DOG:111']], [2, ['EMU:222']], // round 1: 8 6 6 (Yellow leads)
    [0, ['AT:00']], [1, ['GARDEN:111111']], [2, ['AT:22']], // round 2: 12 18 10 (Blue takes the lead)
    [0, ['TEA:000']], // round 3 (the last turn): 18
  ]
  const g = finished(3, plan, { tangled: [[3, 7], [2, 6]], tangleMagic: [3, 0, 6] })

  it('one point per round (after everyone’s turn), starting at 0, then the Tangles step', () => {
    const chart = storyChart(g, 6)
    expect(chart.rounds).toBe(3)
    expect(chart.series.map((s) => s.points)).toEqual([[0, 8, 12, 18, 21], [0, 6, 18, 18, 18], [0, 6, 10, 10, 16]])
    expect(chart.max).toBe(21)
  })

  it('tangle knots sit on the tangled glyphling’s owner’s line, in the round it was tangled, marked with who did it', () => {
    const knots = storyChart(g, 6).markers.filter((m) => m.kind === 'tangle')
    expect(knots).toEqual([
      { kind: 'tangle', seat: 1, x: 3, turnNo: 7, by: 0, glyphling: 3 },
      { kind: 'tangle', seat: 1, x: 2, turnNo: 6, by: 2, glyphling: 2 },
    ])
  })

  it('lead changes are marked too, but never more than maxMarkers (award stars are drawn separately: awardPoint)', () => {
    const calm = finished(3, plan) // no tangles: the lead change gets its spot (a knot there would take it)
    expect(storyChart(calm, 6).markers).toEqual([{ kind: 'lead', seat: 1, x: 2, turnNo: 6 }])
    expect(storyChart(g, 6).markers.some((m) => m.kind === 'lead')).toBe(false) // same spot as Blue's knot: the knot wins
    expect(storyChart(g, 6).markers.some((m) => m.kind === 'award')).toBe(false)
    expect(storyChart(g, 1).markers).toHaveLength(1)
  })
})

describe('real games (the engine’s random player)', () => {
  const words = new Map(['AT', 'TA', 'AN', 'NA', 'IN', 'IT', 'TO', 'ON', 'NO', 'ES', 'RE', 'ER', 'EAT', 'TEA', 'ATE', 'NET', 'TEN', 'SET', 'RAT', 'TAR', 'ART'].map((w) => [w, 1]))
  for (const players of [2, 3, 4]) {
    it(`${players} players: cards add up to the totals, awards follow the rules (once per player, a star on the holder’s line), the chart ends on the totals`, () => {
      for (const seed of [1, 2, 3, 4]) {
        let state = newGame({ players, seed })
        let rng = seed
        while (state.phase !== 'over') {
          const pick = randomAction(state, rng)
          rng = pick.rng
          state = applyAction(state, pick.action, words)
        }
        scorecards(state).forEach((c) => expect(c.wordMagic + c.tangleMagic).toBe(c.total))
        const awards = earnedAwards(state)
        const keys = awards.map((a) => `${a.id}:${a.holder}`)
        expect(new Set(keys).size).toBe(keys.length) // each award at most once per player
        expect(awards.filter((a) => a.id === 'comeback').length).toBeLessThanOrEqual(1)
        const chart = storyChart(state, endscreen.maxMarkers)
        for (const a of awards) expect(awardPoint(state, chart, a)?.seat).toBe(a.holder)
        expect(chart.series.map((s) => s.points.at(-1))).toEqual(state.magic)
        expect(chart.markers.length).toBeLessThanOrEqual(endscreen.maxMarkers)
      }
    })
  }
})

describe('a game saved before the log existed, played to the end (a partial log)', () => {
  // Two turns were played before the log existed (12 Magic for seat 0, 5 for seat 1); the log has only the last two
  const whole = finished(2, [[0, ['CAT:000']], [1, ['TO:01']]], { tangleMagic: [2, 0] })
  const partial: GameState = { ...whole, magic: [whole.magic[0] + 12, whole.magic[1] + 5], turnCount: whole.turnCount + 2 }

  it('knows the log is partial', () => {
    expect(logIsComplete(whole)).toBe(true)
    expect(logIsComplete(partial)).toBe(false)
    expect(logIsComplete({ ...whole, log: undefined })).toBe(false)
  })
  it('Magic from words = total − tangle bonus, so the split always adds up', () => {
    const cards = scorecards(partial)
    expect(cards.map((c) => c.wordMagic + c.tangleMagic)).toEqual(partial.magic)
    expect(cards[0].wordMagic).toBe(partial.magic[0] - 2)
  })
  it('draws no misleading story: just the start and the end, no markers', () => {
    const chart = storyChart(partial, endscreen.maxMarkers)
    expect(chart.rounds).toBe(0)
    expect(chart.series.map((s) => s.points)).toEqual([[0, partial.magic[0]], [0, partial.magic[1]]])
    expect(chart.markers).toEqual([])
  })
})
