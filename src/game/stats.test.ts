import { describe, expect, it } from 'vitest'
import { applyAction } from '../engine/engine'
import { randomAction } from '../engine/sim'
import { newGame } from '../engine/setup'
import { winnersOf } from '../engine/tangle'
import type { GameState, LogTurn } from '../engine/types'
import endscreen from '../../content/tuning/endscreen.json'
import { logIsComplete } from '../engine/log'
import { awardCandidates, pickAwards, scorecards, standings, storyChart } from './stats'

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
    expect(pickAwards(old).every((a) => a.id === 'photoFinish')).toBe(true) // only what the totals alone can tell
    expect(storyChart(old, [], 6).series[2].points).toEqual([0, 7])
  })
})

describe('awards', () => {
  it('2 players: 3 awards, one each before anyone gets a second', () => {
    const g = finished(2, [
      [0, ['GARDENS:0000000']], // Yellow: 14 — biggest turn + longest word
      [1, ['TO:01', 'AT:11']], //   Blue: 7, two birds
      [0, ['AT:00']],
      [1, ['BAT:111', 'TAB:111']], // Blue 12+... (two birds again)
    ])
    const awards = pickAwards(g)
    expect(awards).toHaveLength(3)
    const holders = awards.map((a) => a.holder)
    expect(new Set(holders.slice(0, 2)).size).toBe(2) // the first two go to different players
    expect(awards.every((a) => a.holder === null || a.holder < 2)).toBe(true)
  })

  it('4 players: 4 awards, every player gets one when there are enough', () => {
    const g = finished(4, [
      [0, ['GARDENS:0000000']],
      [1, ['TO:10', 'AT:11', 'ON:11']],
      [2, ['ZAP:212']],
      [3, ['BAT:333']],
      [0, ['AT:00']],
      [1, ['AT:11']],
      [2, ['AT:22']],
      [3, ['QUIET:33333']],
    ], { tangled: [[2, 8], [4, 7]], tangleMagic: [0, 6, 0, 3] })
    const awards = pickAwards(g)
    expect(awards).toHaveLength(4)
    expect(new Set(awards.map((a) => a.holder)).size).toBe(4)
  })

  it('a photo finish replaces the deciding turn', () => {
    const g = finished(2, [[0, ['CAT:000']], [1, ['GARDEN:111111']], [0, ['TEAS:0000']]]) // 6, 12, then Yellow 14 vs 12
    const ids = pickAwards(g).map((a) => a.id)
    expect(ids[0]).toBe('photoFinish')
    expect(ids).not.toContain('deciding')
    expect(pickAwards(g)[0]).toMatchObject({ holder: null, seats: [0, 1], values: { n: 2 } })
  })

  it('the deciding turn: when the winner took the lead for good', () => {
    const g = finished(2, [
      [0, ['GARDEN:000000']], // Yellow 12
      [1, ['AT:11']], //        Blue 4
      [0, ['AT:00']], //        Yellow 16
      [1, ['GARDENS:1111111', 'AT:11']], // Blue 22 — leads
      [1, ['SEAT:1111']], //    Blue 30 (a 2nd turn in a row, as if Yellow were all tangled)
      [0, ['GARDENERS:000000000', 'TO:00']], // Yellow 38: leads for good on turn 6
    ])
    const deciding = awardCandidates(g, endscreen).find((c) => c.id === 'deciding')!.make(0)
    expect(deciding).toMatchObject({ holder: 0, moment: 6, values: { tangles: false } })
  })

  it('the deciding moment can be the tangle bonus', () => {
    const g = finished(2, [[0, ['GARDEN:000000']], [1, ['GARDENS:1111111']]], { tangleMagic: [20, 0] }) // 12 vs 14, then +20
    const deciding = awardCandidates(g, endscreen).find((c) => c.id === 'deciding')!.make(0)
    expect(deciding).toMatchObject({ holder: 0, moment: 'tangles', values: { tangles: true, n: 20 } })
  })

  it('no deciding turn when the winner led the whole way, and none for a shared win', () => {
    const led = finished(2, [[0, ['GARDEN:000000']], [1, ['AT:11']], [0, ['AT:00']]])
    expect(awardCandidates(led, endscreen).map((c) => c.id)).not.toContain('deciding')
    const tie = finished(2, [[0, ['CAT:000']], [1, ['CAT:111']]])
    expect(standings(tie).map((s) => s.place)).toEqual([1, 1])
    expect(awardCandidates(tie, endscreen).map((c) => c.id)).not.toContain('deciding')
    expect(awardCandidates(tie, endscreen).map((c) => c.id)).not.toContain('photoFinish')
  })

  it('ties for an award go to a player who has none yet', () => {
    const g = finished(3, [[0, ['CAT:000']], [1, ['DOG:111']], [2, ['EMU:222']]]) // a three-way tie on everything
    const awards = pickAwards(g)
    expect(new Set(awards.map((a) => a.holder)).size).toBe(awards.length)
  })

  it('awards that don’t apply are skipped (borrowed bloom needs a word mostly of rivals’ seeds)', () => {
    const solo = finished(2, [[0, ['CAT:000']], [1, ['DOG:111']]])
    expect(awardCandidates(solo, endscreen).map((c) => c.id)).not.toContain('borrowedBloom')
    const borrowed = finished(2, [[0, ['CAT:110']], [1, ['DOG:111']]])
    expect(awardCandidates(borrowed, endscreen).find((c) => c.id === 'borrowedBloom')?.holders).toEqual([0])
  })

  it('brave knot: tangled their own glyphling to end it — and whether it worked', () => {
    const g = finished(2, [[0, ['CAT:000']], [1, ['DOGS:1111']], [0, ['AT:00']]], { tangled: [[0, 3], [3, 2]], selfTangle: true, tangleMagic: [9, 0] })
    const brave = awardCandidates(g, endscreen).find((c) => c.id === 'braveKnot')!.make(0)
    expect(brave).toMatchObject({ holder: 0, moment: 3, values: { won: true } })
  })

  it('knot tier: who tangled a rival, and whose glyphling it was', () => {
    const g = finished(3, [[0, ['CAT:000']], [1, ['DOG:111']], [2, ['EMU:222']]], { tangled: [[0, 2], [5, 2]] })
    const knot = awardCandidates(g, endscreen).find((c) => c.id === 'knotTier')!
    expect(knot.holders).toEqual([1])
    expect(knot.make(1)).toMatchObject({ seats: [1, 0], values: { other: 0 } })
  })

  it('awardPriority 0 turns an award off', () => {
    const g = finished(2, [[0, ['GARDENS:0000000']], [1, ['TO:01', 'AT:11']]])
    const off = { ...endscreen, awardPriority: { ...endscreen.awardPriority, biggestTurn: 0, longestWord: 0 } }
    const ids = pickAwards(g, off).map((a) => a.id)
    expect(ids).not.toContain('biggestTurn')
    expect(ids).not.toContain('longestWord')
  })

  it('never more awards than asked for, and never more than one per player while someone has none', () => {
    for (const players of [2, 3, 4]) {
      const plan: TurnPlan[] = []
      for (let round = 0; round < 5; round++) for (let seat = 0; seat < players; seat++) plan.push([seat, [`${'ABCDEFG'.slice(0, 2 + ((seat + round) % 5))}:${String(seat).repeat(2 + ((seat + round) % 5))}`]])
      const awards = pickAwards(finished(players, plan))
      expect(awards.length).toBeLessThanOrEqual(players === 4 ? 4 : 3)
      const holders = awards.map((a) => a.holder).filter((h) => h !== null)
      if (holders.length <= players) expect(new Set(holders).size).toBe(holders.length)
    }
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
    const chart = storyChart(g, [], 6)
    expect(chart.rounds).toBe(3)
    expect(chart.series.map((s) => s.points)).toEqual([[0, 8, 12, 18, 21], [0, 6, 18, 18, 18], [0, 6, 10, 10, 16]])
    expect(chart.max).toBe(21)
  })

  it('tangle knots sit on the tangled glyphling’s owner’s line, in the round it was tangled, marked with who did it', () => {
    const knots = storyChart(g, [], 6).markers.filter((m) => m.kind === 'tangle')
    expect(knots).toEqual([
      { kind: 'tangle', seat: 1, x: 3, turnNo: 7, by: 0, glyphling: 3 },
      { kind: 'tangle', seat: 1, x: 2, turnNo: 6, by: 2, glyphling: 2 },
    ])
  })

  it('lead changes and award moments are marked too, but never more than maxMarkers', () => {
    const calm = finished(3, plan) // no tangles: the lead change gets its spot (a knot there would take it)
    expect(storyChart(calm, [], 6).markers).toEqual([{ kind: 'lead', seat: 1, x: 2, turnNo: 6 }])
    expect(storyChart(g, [], 6).markers.some((m) => m.kind === 'lead')).toBe(false) // same spot as Blue's knot: the knot wins
    const awards = pickAwards(g)
    expect(storyChart(g, awards, 6).markers.some((m) => m.kind === 'award')).toBe(true)
    expect(storyChart(g, awards, 2).markers).toHaveLength(2)
  })
})

describe('real games (the engine’s random player)', () => {
  const words = new Map(['AT', 'TA', 'AN', 'NA', 'IN', 'IT', 'TO', 'ON', 'NO', 'ES', 'RE', 'ER', 'EAT', 'TEA', 'ATE', 'NET', 'TEN', 'SET', 'RAT', 'TAR', 'ART'].map((w) => [w, 1]))
  for (const players of [2, 3, 4]) {
    it(`${players} players: cards add up to the totals, awards follow the rules, the chart ends on the totals`, () => {
      for (const seed of [1, 2, 3, 4]) {
        let state = newGame({ players, seed })
        let rng = seed
        while (state.phase !== 'over') {
          const pick = randomAction(state, rng)
          rng = pick.rng
          state = applyAction(state, pick.action, words)
        }
        scorecards(state).forEach((c) => expect(c.wordMagic + c.tangleMagic).toBe(c.total))
        const awards = pickAwards(state)
        expect(awards.length).toBeLessThanOrEqual(players === 4 ? 4 : 3)
        const holders = awards.flatMap((a) => (a.holder === null ? [] : [a.holder]))
        expect(new Set(holders).size).toBe(Math.min(holders.length, players)) // a second award only once everyone has one
        const chart = storyChart(state, awards, endscreen.maxMarkers)
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
    const chart = storyChart(partial, pickAwards(partial, endscreen), endscreen.maxMarkers)
    expect(chart.rounds).toBe(0)
    expect(chart.series.map((s) => s.points)).toEqual([[0, partial.magic[0]], [0, partial.magic[1]]])
    expect(chart.markers).toEqual([])
  })
})
