// THE END SCREEN'S NUMBERS — worked out from the finished game's log (src/engine/log.ts). Pure: no React, no store.
//   standings(game)        who came where (ties share a place)
//   scorecards(game)       one per player: Magic from words / solo words / tangles, words by length, best turn…
//   pickAwards(game, t)    the highlights (research/end-screen.md §3): fun titles, never Magic, never "worst at"
//   storyChart(game, …)    Magic over the rounds, one line per player, plus a Tangles step and moment markers
// The words for all of it live in content/text/en.json → game.end; the knobs in content/tuning/endscreen.json.
import { logOf } from '../engine/log'
import type { GameState, LogTurn, LogWord } from '../engine/types'
import endscreenFile from '../../content/tuning/endscreen.json'

export type EndTuning = typeof endscreenFile

// ─── Standings ───────────────────────────────────────────────

export interface Standing {
  seat: number
  magic: number
  /** 1 = first. Equal Magic shares a place ("=2nd"); the next place skips (1, =2, =2, 4). */
  place: number
  /** Someone else has the same place. */
  tied: boolean
}

/** Best first; equal Magic keeps seat order. */
export function standings(game: GameState): Standing[] {
  const magic = game.magic
  return magic
    .map((m, seat) => ({
      seat,
      magic: m,
      place: 1 + magic.filter((other) => other > m).length,
      tied: magic.filter((other) => other === m).length > 1,
    }))
    .sort((a, b) => a.place - b.place || a.seat - b.seat)
}

// ─── Scorecards ──────────────────────────────────────────────

/** Word-length buckets on the scorecard: 2, 3, 4, 5, 6+ letters. */
export const LENGTHS = [2, 3, 4, 5, 6] as const

export interface Scorecard {
  seat: number
  total: number
  /** Magic from words (everything but the tangle bonus). */
  wordMagic: number
  /** …of which from solo words: words made only of this player's own seeds. */
  soloMagic: number
  tangleMagic: number
  /** How many words of 2, 3, 4, 5, 6+ letters (the same order as LENGTHS). */
  byLength: number[]
  wordsMade: number
  longestWord: string
  bestWord: { word: string; magic: number } | null
  bestTurn: { magic: number; words: string[]; turnNo: number } | null
  /** Turns that grew 2 or more words at once. */
  multiWordTurns: number
  /** Seeds set aside on refreshes, all game. */
  seedsRefreshed: number
  /** Rivals' glyphlings this player tangled (still tangled at the end). */
  tangledRivals: number
  /** This player's glyphlings tangled at the end. */
  gotTangled: number
  /** Letters from other players' seeds in this player's words. */
  lettersBorrowed: number
  /** This player's seeds in other players' words. */
  lettersGiven: number
}

const bucketOf = (length: number) => Math.min(length, 6) - 2 // 2 → 0 … 6+ → 4 (1-letter words don't exist)
const isSolo = (w: LogWord, seat: number) => w.owners.every((o) => o === seat)

/** Who tangled each glyphling still tangled at the end: the seat whose turn last tangled it (glyphling id → seat). */
export function tanglers(turns: LogTurn[]): Map<number, number> {
  const by = new Map<number, number>()
  for (const t of turns) for (const id of t.newlyTangled) by.set(id, t.seat)
  return by
}

export function scorecards(game: GameState): Scorecard[] {
  const log = logOf(game)
  const ownerOf = (id: number) => game.glyphlings.find((g) => g.id === id)?.seat ?? -1
  const tangledBy = tanglers(log.turns)
  return game.magic.map((total, seat) => {
    const mine = log.turns.filter((t) => t.seat === seat)
    const words = mine.flatMap((t) => t.words)
    const byLength = LENGTHS.map(() => 0)
    for (const w of words) byLength[bucketOf(w.word.length)] += 1
    const best = mine.reduce<LogTurn | null>((top, t) => (t.magic > (top?.magic ?? 0) ? t : top), null)
    const bestWord = words.reduce<LogWord | null>((top, w) => (w.magic > (top?.magic ?? 0) ? w : top), null)
    const othersWords = log.turns.filter((t) => t.seat !== seat).flatMap((t) => t.words)
    return {
      seat,
      total,
      wordMagic: mine.reduce((sum, t) => sum + t.magic, 0),
      soloMagic: words.filter((w) => isSolo(w, seat)).reduce((sum, w) => sum + w.magic, 0),
      tangleMagic: game.tangleMagic[seat] ?? 0,
      byLength,
      wordsMade: words.length,
      longestWord: words.reduce((top, w) => (w.word.length > top.length ? w.word : top), ''),
      bestWord: bestWord && { word: bestWord.word, magic: bestWord.magic },
      bestTurn: best && { magic: best.magic, words: best.words.map((w) => w.word), turnNo: best.turnNo },
      multiWordTurns: mine.filter((t) => t.words.length >= 2).length,
      seedsRefreshed: mine.reduce((sum, t) => sum + t.refreshed, 0),
      tangledRivals: game.tangled.filter((id) => tangledBy.get(id) === seat && ownerOf(id) !== seat).length,
      gotTangled: game.tangled.filter((id) => ownerOf(id) === seat).length,
      lettersBorrowed: words.reduce((sum, w) => sum + w.owners.filter((o) => o !== seat).length, 0),
      lettersGiven: othersWords.reduce((sum, w) => sum + w.owners.filter((o) => o === seat).length, 0),
    }
  })
}

// ─── Awards ──────────────────────────────────────────────────

export type AwardId = keyof EndTuning['awardPriority']

export interface Award {
  id: AwardId
  /** The player it's for (null = about the whole table, e.g. Photo finish). */
  holder: number | null
  /** Players to show beside it (the holder first). */
  seats: number[]
  /** The moment it points at on the Story chart: a turn, 'tangles' (the end bonus), or null (no one moment). */
  moment: number | 'tangles' | null
  /** Fill-ins for its words in en.json: n (a number), word, words, round, other (a seat), won… */
  values: Record<string, string | number | boolean>
}

/** A possible award: everyone who could hold it, best (or earliest) first. */
interface Candidate { id: AwardId; holders: number[]; tableWide?: boolean; make: (holder: number) => Award }

/** Never shown together: the first one picked wins the slot. */
const EXCLUSIVE: AwardId[][] = [['photoFinish', 'deciding'], ['knotTier', 'braveKnot']]

/** Everything with the best value (above 0), earliest first. */
function bestOf<T>(items: T[], value: (x: T) => number): T[] {
  const best = Math.max(0, ...items.map(value))
  return best > 0 ? items.filter((x) => value(x) === best) : []
}
const uniqueSeats = (seats: number[]) => [...new Set(seats)]

/** Every award that applies to this game (unordered; pickAwards chooses). */
export function awardCandidates(game: GameState, tuning: EndTuning): Candidate[] {
  const log = logOf(game)
  const turns = log.turns
  const cards = scorecards(game)
  const ranked = standings(game)
  const winners = game.winners.length ? game.winners : ranked.filter((s) => s.place === 1).map((s) => s.seat)
  const soleWinner = winners.length === 1 ? winners[0] : null
  const out: Candidate[] = []
  const turnAward = (id: AwardId, list: LogTurn[], value: (t: LogTurn) => number, values: (t: LogTurn) => Award['values']) => {
    const top = bestOf(list, value)
    if (!top.length) return
    out.push({
      id, holders: uniqueSeats(top.map((t) => t.seat)),
      make: (holder) => {
        const t = top.find((x) => x.seat === holder)!
        return { id, holder, seats: [holder], moment: t.turnNo, values: { n: value(t), round: t.round, ...values(t) } }
      },
    })
  }
  const wordsOf = (t: LogTurn) => t.words.map((w) => w.word)

  // Photo finish (table-wide): won by photoFinishMax or less
  if (soleWinner !== null && ranked.length > 1) {
    const margin = ranked[0].magic - ranked[1].magic
    if (margin <= tuning.photoFinishMax) {
      const second = ranked.filter((s) => s.place === 2).map((s) => s.seat)
      out.push({ id: 'photoFinish', holders: [soleWinner], tableWide: true, make: () => ({ id: 'photoFinish', holder: null, seats: [soleWinner, ...second], moment: 'tangles', values: { n: margin } }) })
    }
  }

  // The deciding turn: the last time the lead changed hands — the winner led alone from then on
  if (soleWinner !== null && turns.length) {
    const leader = (totals: number[]) => {
      const top = Math.max(...totals)
      const at = totals.flatMap((m, seat) => (m === top ? [seat] : []))
      return at.length === 1 ? at[0] : null
    }
    const points = [...turns.map((t) => t.totalsAfter), game.magic]
    let from = points.length - 1
    while (from > 0 && leader(points[from - 1]) === soleWinner) from--
    const someoneElseLed = points.slice(0, from).some((p) => { const l = leader(p); return l !== null && l !== soleWinner })
    if (someoneElseLed) {
      const t = turns[from]
      out.push({
        id: 'deciding', holders: [soleWinner],
        make: (): Award => (t
          ? { id: 'deciding', holder: soleWinner, seats: [soleWinner], moment: t.turnNo, values: { round: t.round, n: t.magic, words: wordsOf(t).join(' + '), tangles: false } }
          : { id: 'deciding', holder: soleWinner, seats: [soleWinner], moment: 'tangles', values: { n: game.tangleMagic[soleWinner], tangles: true } }),
      })
    }
  }

  turnAward('biggestTurn', turns, (t) => t.magic, (t) => ({ words: wordsOf(t).join(' + ') }))
  turnAward('twoBirds', turns.filter((t) => t.words.length >= tuning.twoBirdsMin), (t) => t.words.length, (t) => ({ words: wordsOf(t).join(' + ') }))

  // Word awards: the best word of a kind, with the turn it was grown on
  const allWords = turns.flatMap((t) => t.words.map((w) => ({ t, w })))
  const wordAward = (id: AwardId, list: typeof allWords, value: (x: (typeof allWords)[number]) => number) => {
    const top = bestOf(list, value)
    if (!top.length) return
    out.push({
      id, holders: uniqueSeats(top.map((x) => x.t.seat)),
      make: (holder) => {
        const { t, w } = top.find((x) => x.t.seat === holder)!
        return { id, holder, seats: [holder], moment: t.turnNo, values: { n: value({ t, w }), word: w.word, magic: w.magic, round: t.round } }
      },
    })
  }
  wordAward('longestWord', allWords, (x) => x.w.word.length)
  wordAward('borrowedBloom', allWords.filter(({ t, w }) => w.owners.filter((o) => o !== t.seat).length * 2 > w.owners.length), (x) => x.w.magic)
  wordAward('rareSeed', allWords.filter(({ w }) => w.letters.some((l) => /^(Q|Z|X|J)/i.test(l))), (x) => x.w.magic)

  // Per-player totals
  const playerAward = (id: AwardId, value: (c: Scorecard) => number, min = 1, values: (c: Scorecard) => Award['values'] = () => ({})) => {
    const top = Math.max(...cards.map(value))
    if (top < min) return
    out.push({
      id, holders: cards.filter((c) => value(c) === top).map((c) => c.seat),
      make: (holder) => ({ id, holder, seats: [holder], moment: null, values: { n: top, ...values(cards[holder]) } }),
    })
  }
  playerAward('soloGrower', (c) => c.soloMagic)
  playerAward('generousGardener', (c) => c.lettersGiven, tuning.generousMin)
  playerAward('tangleHarvest', (c) => c.tangleMagic)

  // Knot tier: tangled a rival's glyphling (who it was is told)
  const tangledBy = tanglers(turns)
  const knots = game.tangled.flatMap((id) => {
    const by = tangledBy.get(id)
    const owner = game.glyphlings.find((g) => g.id === id)?.seat
    const turn = [...turns].reverse().find((t) => t.newlyTangled.includes(id))
    return by !== undefined && owner !== undefined && by !== owner && turn ? [{ by, owner, turn }] : []
  })
  if (knots.length) {
    out.push({
      id: 'knotTier', holders: uniqueSeats(knots.map((k) => k.by)),
      make: (holder) => {
        const k = knots.find((x) => x.by === holder)!
        return { id: 'knotTier', holder, seats: [holder, k.owner], moment: k.turn.turnNo, values: { other: k.owner, round: k.turn.round, n: knots.filter((x) => x.by === holder).length } }
      },
    })
  }

  // Brave knot: ended the game by tangling their own glyphling — and the gamble worked, or didn't
  if (log.end?.selfTangle) {
    const by = log.end.endedBy
    out.push({ id: 'braveKnot', holders: [by], make: () => ({ id: 'braveKnot', holder: by, seats: [by], moment: log.end!.endedOnTurn, values: { won: winners.includes(by) } }) })
  }

  // Secret leader: led alone at the end of the most rounds
  const rounds = roundEnds(turns)
  const ledRounds = game.magic.map((_, seat) => rounds.filter((t) => {
    const top = Math.max(...t.totalsAfter)
    return t.totalsAfter[seat] === top && t.totalsAfter.filter((m) => m === top).length === 1
  }).length)
  playerAward('secretLeader', (c) => ledRounds[c.seat], tuning.secretLeaderMinRounds, () => ({ rounds: rounds.length }))

  // Comeback: the biggest gap the (sole) winner closed
  if (soleWinner !== null) {
    const gap = Math.max(0, ...turns.map((t) => Math.max(...t.totalsAfter) - t.totalsAfter[soleWinner]))
    if (gap >= tuning.comebackMin) {
      out.push({ id: 'comeback', holders: [soleWinner], make: () => ({ id: 'comeback', holder: soleWinner, seats: [soleWinner], moment: null, values: { n: gap } }) })
    }
  }

  // Fresh start: the most Magic on a player's next turn after a refresh
  const after = turns.filter((t, i) => {
    const prev = turns.slice(0, i).reverse().find((p) => p.seat === t.seat)
    return prev?.refresh === true
  })
  turnAward('freshStart', after, (t) => t.magic, (t) => ({ words: wordsOf(t).join(' + ') }))

  return out
}

/**
 * The highlights to show: by awardPriority (0 = off), awardsFor2/3/4 of them, and no player gets a second
 * award until every player has one (Fellowship — in a 4-player game everyone gets a moment).
 */
export function pickAwards(game: GameState, tuning: EndTuning = endscreenFile): Award[] {
  const players = game.config.players
  const want = (tuning as Record<string, unknown>)[`awardsFor${players}`] as number | undefined ?? 3
  const priority = tuning.awardPriority as Record<AwardId, number>
  const candidates = awardCandidates(game, tuning)
    .filter((c) => (priority[c.id] ?? 0) > 0)
    .sort((a, b) => priority[a.id] - priority[b.id])
  const picked: Award[] = []
  const awarded = new Set<number>()
  for (const c of candidates) {
    if (picked.length >= want) break
    if (EXCLUSIVE.some((group) => group.includes(c.id) && picked.some((p) => group.includes(p.id)))) continue
    if (c.tableWide) { picked.push(c.make(c.holders[0])); continue }
    const everyoneHasOne = awarded.size >= players
    const holder = c.holders.find((seat) => !awarded.has(seat)) ?? (everyoneHasOne ? c.holders[0] : undefined)
    if (holder === undefined) continue
    picked.push(c.make(holder))
    awarded.add(holder)
  }
  return picked
}

// ─── The Story chart ─────────────────────────────────────────

/** The last turn of each round, in order. */
export function roundEnds(turns: LogTurn[]): LogTurn[] {
  return turns.filter((t, i) => turns[i + 1]?.round !== t.round)
}

export interface ChartMarker {
  kind: 'tangle' | 'award' | 'lead'
  /** The line it sits on. */
  seat: number
  /** x = round number (0 = the start); rounds + 1 = the Tangles step. */
  x: number
  /** The turn to tell about when it's tapped (null = the tangle bonus at the end). */
  turnNo: number | null
  /** tangle: who tangled it (its outline colour). */
  by?: number
  /** tangle: which glyphling. award: which award. */
  glyphling?: number
  award?: AwardId
}

export interface StoryChart {
  rounds: number
  /** One line per seat: Magic at the start (0), after each round, then after the tangle bonus. */
  series: { seat: number; points: number[] }[]
  markers: ChartMarker[]
  /** The biggest number on the chart (for the scale). */
  max: number
}

export function storyChart(game: GameState, awards: Award[], maxMarkers: number): StoryChart {
  const turns = logOf(game).turns
  const ends = roundEnds(turns)
  const rounds = ends.length
  const series = game.magic.map((final, seat) => ({ seat, points: [0, ...ends.map((t) => t.totalsAfter[seat]), final] }))
  const roundOf = (turnNo: number) => turns.find((t) => t.turnNo === turnNo)?.round ?? rounds
  // Tangles: on the tangled glyphling's owner's line, in the round it got tangled, outlined in the tangler's colour
  const tangledBy = tanglers(turns)
  const tangleMarks: ChartMarker[] = game.tangled.flatMap((id) => {
    const turn = [...turns].reverse().find((t) => t.newlyTangled.includes(id))
    const owner = game.glyphlings.find((g) => g.id === id)?.seat
    if (!turn || owner === undefined) return []
    return [{ kind: 'tangle' as const, seat: owner, x: turn.round, turnNo: turn.turnNo, by: tangledBy.get(id), glyphling: id }]
  })
  const awardMarks: ChartMarker[] = awards.flatMap((a): ChartMarker[] => {
    const seat = a.holder ?? a.seats[0]
    if (a.moment === null || seat === undefined) return []
    if (a.moment === 'tangles') return [{ kind: 'award' as const, seat, x: rounds + 1, turnNo: null, award: a.id }]
    return [{ kind: 'award' as const, seat, x: roundOf(a.moment), turnNo: a.moment, award: a.id }]
  })
  // Lead changes: where a new player leads alone at a round's end
  const leadMarks: ChartMarker[] = []
  let leader: number | null = null
  ends.forEach((t) => {
    const top = Math.max(...t.totalsAfter)
    const at = t.totalsAfter.flatMap((m, seat) => (m === top ? [seat] : []))
    if (at.length !== 1 || at[0] === leader) return
    if (leader !== null) leadMarks.push({ kind: 'lead', seat: at[0], x: t.round, turnNo: t.turnNo })
    leader = at[0]
  })
  // No two markers on the same spot; tangles first, then awards, then lead changes
  const markers: ChartMarker[] = []
  for (const m of [...tangleMarks, ...awardMarks, ...leadMarks]) {
    if (markers.length >= maxMarkers) break
    if (markers.some((o) => o.seat === m.seat && o.x === m.x)) continue
    markers.push(m)
  }
  const max = Math.max(1, ...series.flatMap((s) => s.points))
  return { rounds, series, markers, max }
}
