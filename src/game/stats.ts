// THE END SCREEN'S NUMBERS — worked out from the finished game's log (src/engine/log.ts). Pure: no React, no store.
//   standings(game)        who came where (ties share a place)
//   scorecards(game)       one per player: Magic from words / solo words / tangles, words by length, best turn…
//   earnedAwards(game, t)  the Highlights: skill awards earned this game, measured from the log's facts (never Magic)
//   awardPoint(…)          where an award's star sits on the Story chart
//   storyChart(game, …)    Magic over the rounds, one line per player, plus a Tangles step and moment markers
// The words for all of it live in content/text/en.json → game.end; the knobs in content/tuning/endscreen.json.
import { logIsComplete, logOf } from '../engine/log'
import type { GameState, LogTurn, LogWord } from '../engine/types'
import endscreenFile from '../../content/tuning/endscreen.json'
import textFile from '../../content/text/en.json'

const endWords = textFile.game.gameOver

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
  /** Rivals' glyphlings this player COMPLETELY tangled: only this player's seeds next to it when it got tangled
   *  (the board edge ignored; log.ts completeTangler). null = unknown: a log written before they were recorded. */
  completeTangles: number | null
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
  // (an old log can't say: unknown for everyone, rather than a wrong 0)
  const knowsComplete = logIsComplete(game) && log.turns.every((t) => t.completeTangles)
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
      wordMagic: total - (game.tangleMagic[seat] ?? 0), // (not summed from the log: an old save's log can be partial)
      soloMagic: words.filter((w) => isSolo(w, seat)).reduce((sum, w) => sum + w.magic, 0),
      tangleMagic: game.tangleMagic[seat] ?? 0,
      byLength,
      wordsMade: words.length,
      longestWord: words.reduce((top, w) => (w.word.length > top.length ? w.word : top), ''),
      bestWord: bestWord && { word: bestWord.word, magic: bestWord.magic },
      bestTurn: best && { magic: best.magic, words: best.words.map((w) => w.word), turnNo: best.turnNo },
      multiWordTurns: mine.filter((t) => t.words.length >= 2).length,
      seedsRefreshed: mine.reduce((sum, t) => sum + t.refreshed, 0),
      completeTangles: knowsComplete
        ? log.turns.reduce((sum, t) => sum + (t.completeTangles ?? []).filter((c) => c.by === seat).length, 0)
        : null,
      lettersBorrowed: words.reduce((sum, w) => sum + w.owners.filter((o) => o !== seat).length, 0),
      lettersGiven: othersWords.reduce((sum, w) => sum + w.owners.filter((o) => o === seat).length, 0),
    }
  })
}

// ─── Awards ──────────────────────────────────────────────────
// The Highlights (GDD §4 Awards; Muzzy, 2026-10-02): "achievements should incentivize specific and correct/clever
// plays" — and "this game is secretly more about positioning and blocking your opponent than it is spelling". Intent
// can't be read, so each award measures a turn's EFFECT (the log's facts, engine/insight.ts) and is earned only when
// the effect is big (endscreen.json thresholds); its caption shows the proof ("Blue: 9 moves → 2"). Never luck, never
// bad play — a rival's mistake becomes the other player's award. Only awards actually earned show, each at most once
// per player per game (its biggest moment); Biggest comeback once per game. Awards never add Magic.

export type AwardId = keyof EndTuning['awardOrder']

export interface Award {
  id: AwardId
  /** The player it's for. */
  holder: number
  /** Players to show beside it (the holder first). */
  seats: number[]
  /** The turn it points at (turnNo): where the Story chart's star goes, on the holder's line. */
  moment: number
  /** Fill-ins for its words in en.json: n (a number), word, other (a seat)… */
  values: Record<string, string | number | boolean>
  /** How big the effect was (the bigger one wins between moments of the same award). */
  effect: number
}

const keyOf = (h: { q: number; r: number }) => `${h.q},${h.r}`
const ownerOfGlyphling = (game: GameState, id: number) => game.glyphlings.find((g) => g.id === id)?.seat ?? Math.floor(id / 2)

/** Every award earned this game, best moment per player per award, in the carousel's order (awardOrder, then size). */
export function earnedAwards(game: GameState, tuning: EndTuning = endscreenFile): Award[] {
  const log = logOf(game)
  const turns = log.turns
  if (!turns.length) return []
  const t = tuning
  const found: Award[] = []
  const add = (id: AwardId, holder: number, turn: LogTurn, effect: number, values: Award['values'], seats: number[] = []) =>
    found.push({ id, holder, seats: [...new Set([holder, ...seats])], moment: turn.turnNo, values: { round: turn.round, ...values }, effect })
  const wordsOf = (turn: LogTurn) => turn.words.map((w) => w.word).join(endWords.and)
  const rivalsOf = (seat: number) => game.glyphlings.filter((g) => g.seat !== seat)
  const totalsBefore = (i: number) => (i > 0 ? turns[i - 1].totalsAfter : game.magic.map(() => 0))
  const everTangled = (id: number) => game.tangled.includes(id) || turns.some((x) => x.tangledAfter.includes(id))

  turns.forEach((turn, i) => {
    const seat = turn.seat
    const m = turn.mobility
    // ── Positioning & blocking ──
    if (m) {
      for (const g of rivalsOf(seat)) {
        const [from, mid, to] = [m.before[g.id], m.afterMove[g.id], m.afterCast[g.id]]
        if (from === undefined || mid === undefined || to === undefined) continue
        // Lockdown: this turn took a rival glyphling from many moves to almost none
        if (from - to >= t.lockdownMinDrop && to <= t.lockdownMaxAfter) {
          add('lockdown', seat, turn, from - to, { other: g.seat, from, to }, [g.seat])
        }
        // Pincer: the move AND the cast each took moves from the same rival glyphling
        if (from - mid >= t.pincerMinEach && mid - to >= t.pincerMinEach && from - to >= t.pincerMinDrop) {
          add('pincer', seat, turn, from - to, { other: g.seat, from, mid, to }, [g.seat])
        }
      }
      // Close call: one of the mover's glyphlings had 1 move left (the danger cue) at the start of their turn, had
      // plenty after it — and was never tangled all game
      for (const g of game.glyphlings.filter((x) => x.seat === seat)) {
        const now = m.afterCast[g.id] ?? 0
        if (m.before[g.id] === 1 && now >= t.closeCallMinAfter && !everTangled(g.id)) add('closeCall', seat, turn, now, { n: now })
      }
    }
    // Weed toss: a cast that scored (next to) nothing but took a rival's scoring spot, or cut a rival's moves
    if (turn.letter !== null && turn.target && turn.magic <= t.weedMaxMagic && m && turn.blocked !== undefined) {
      const refreshed = turn.refresh && turn.refreshed > 0
      const bonus = refreshed ? 0.5 : 0
      const block = turn.blocked && turn.blocked.magic >= t.weedMinBlocked ? turn.blocked : null
      const cut = rivalsOf(seat).map((g) => ({ seat: g.seat, from: m.afterMove[g.id] ?? 0, to: m.afterCast[g.id] ?? 0 }))
        .filter((c) => c.from - c.to >= t.weedMinCut).sort((a, b) => b.from - b.to - (a.from - a.to))[0]
      if (block) add('weedToss', seat, turn, block.magic + bonus, { kind: 'block', other: block.seat, n: block.magic, word: block.word, refreshed }, [block.seat])
      // (the cut kind: thrown to block AND to clear the hand — Muzzy: "to block someone so you can also intentionally refresh")
      else if (cut && refreshed) add('weedToss', seat, turn, cut.from - cut.to + bonus, { kind: 'cut', other: cut.seat, from: cut.from, to: cut.to, refreshed }, [cut.seat])
    }
    // Walled garden: this cast shut the caster's glyphling in a pocket no rival glyphling can reach — then the Magic
    // they made in there (this turn on: every turn of theirs that moved from and to hexes inside it)
    for (const pocket of turn.sealed ?? []) {
      if (pocket.hexes.length > t.walledMaxSize) continue // a cell, not half the garden cut off by chance
      const inside = new Set(pocket.hexes)
      let made = 0
      for (let j = i; j < turns.length; j++) {
        const later = turns[j]
        if (later.seat !== seat || !inside.has(keyOf(later.to)) || (j > i && !inside.has(keyOf(later.from)))) continue
        made += later.magic
      }
      if (made >= t.walledMinMagic) add('walledGarden', seat, turn, made, { n: made })
    }
    // Through the hedge: a scoring cast that flew over the caster's own seeds
    const over = turn.castOver ?? 0
    if (over >= t.hedgeMinOver && turn.magic > 0) add('throughHedge', seat, turn, over * 100 + turn.magic, { over, n: turn.magic })
    // Complete tangle: a rival glyphling tangled with only the holder's pieces round it (log.ts completeTangler)
    for (const c of turn.completeTangles ?? []) {
      if (c.by === null) continue
      const owner = ownerOfGlyphling(game, c.glyphling)
      add('completeTangle', c.by, turn, 1, { other: owner }, [owner])
    }
    // ── Spelling ──
    if (turn.words.length >= t.powerPlayMin) add('powerPlay', seat, turn, turn.words.length * 100 + turn.magic, { n: turn.words.length, words: wordsOf(turn) })
    const longMin = game.config.boardName === 'small' ? t.longWordMinSmall : t.longWordMinLarge
    for (const w of turn.words) {
      if (w.letters.length >= longMin) add('longWord', seat, turn, w.letters.length * 100 + w.magic, { n: w.letters.length, word: w.word })
      // Bridge: the seed landed INSIDE a word — letters already on both sides of it, joined into one word
      if (w.at !== undefined && w.at > 0 && Math.min(w.at, w.letters.length - 1 - w.at) >= t.bridgeMinSide) {
        add('bridge', seat, turn, w.letters.length * 100 + w.magic, { word: w.word, letter: w.letters[w.at], left: w.letters.slice(0, w.at).join(''), right: w.letters.slice(w.at + 1).join('') })
      }
      // Hijack: a word a rival grew earlier, made into a longer one where the holder owns most of the seeds
      const hexes = w.hexes
      if (hexes && w.owners.filter((o) => o === seat).length * 2 > w.owners.length) {
        const mine = new Set(hexes)
        const theirs = turns.slice(0, i).filter((x) => x.seat !== seat).flatMap((x) => x.words.map((v) => ({ x, v })))
          .find(({ v }) => v.hexes && v.letters.length >= t.hijackMinFrom && v.hexes.length < hexes.length && v.hexes.every((h) => mine.has(h)))
        if (theirs) add('hijack', seat, turn, w.magic, { other: theirs.x.seat, from: theirs.v.word, word: w.word, n: w.magic }, [theirs.x.seat])
      }
    }
  })

  // ── Momentum & ending ──
  // Biggest comeback: the one turn that took the lead (alone) from furthest behind — once per game
  let comeback: { turn: LogTurn; behind: number } | null = null
  turns.forEach((turn, i) => {
    const was = totalsBefore(i)
    const best = (totals: number[]) => Math.max(...totals.filter((_, s) => s !== turn.seat))
    const behind = best(was) - was[turn.seat]
    if (behind >= t.comebackMinDeficit && turn.totalsAfter[turn.seat] > best(turn.totalsAfter) && behind > (comeback?.behind ?? 0)) comeback = { turn, behind }
  })
  const back = comeback as { turn: LogTurn; behind: number } | null
  if (back) add('comeback', back.turn.seat, back.turn, back.behind, { n: back.behind, gain: back.turn.magic })
  // The ending: who ended it, and were they ahead or behind at that moment (before the tangle bonus)?
  const end = log.end
  const last = end ? turns.find((x) => x.turnNo === end.endedOnTurn) : undefined
  if (end && last && last.totalsAfter.length > 1) {
    const ender = end.endedBy
    const margin = last.totalsAfter[ender] - Math.max(...last.totalsAfter.filter((_, s) => s !== ender))
    // Called it: ended the game while secretly in the lead — and it held (they won)
    if (margin >= Math.max(1, t.calledItMinLead) && game.winners.includes(ender)) add('calledIt', ender, last, margin, { n: margin })
    // Trickster's Victory: a rival ended the game while behind — the winner gets the credit
    if (-margin >= Math.max(1, t.tricksterMinBehind) && !game.winners.includes(ender)) {
      for (const winner of game.winners) add('trickster', winner, last, -margin, { other: ender, n: -margin }, [ender])
    }
  }

  // Best moment per player per award; then the carousel's order
  const order = tuning.awardOrder as Record<AwardId, number>
  const best = new Map<string, Award>()
  for (const a of found) {
    if (!((order[a.id] ?? 0) > 0)) continue
    const k = `${a.id}:${a.holder}`
    const old = best.get(k)
    if (!old || a.effect > old.effect) best.set(k, a)
  }
  return [...best.values()].sort((a, b) => order[a.id] - order[b.id] || b.effect - a.effect || a.moment - b.moment)
}

/** The Story chart's spot for an award: on the holder's line, at the round of its turn. */
export function awardPoint(game: GameState, chart: StoryChart, award: Award): ChartMarker | null {
  if (chart.rounds === 0) return null
  const turn = logOf(game).turns.find((x) => x.turnNo === award.moment)
  if (!turn) return null
  return { kind: 'award', seat: award.holder, x: Math.min(turn.round, chart.rounds), turnNo: turn.turnNo, award: award.id }
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
  /** tangle: which glyphling. award (the Highlights star, awardPoint): which award. */
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

/** The chart: the lines, plus marks for tangles and lead changes (the current award's star is drawn on top: awardPoint). */
export function storyChart(game: GameState, maxMarkers: number): StoryChart {
  // A log that doesn't cover every turn (an old save) can't tell the story: just the start and the end, no marks
  if (!logIsComplete(game)) {
    return { rounds: 0, series: game.magic.map((final, seat) => ({ seat, points: [0, final] })), markers: [], max: Math.max(1, ...game.magic) }
  }
  const turns = logOf(game).turns
  const ends = roundEnds(turns)
  const rounds = ends.length
  const series = game.magic.map((final, seat) => ({ seat, points: [0, ...ends.map((t) => t.totalsAfter[seat]), final] }))
  // Tangles: on the tangled glyphling's owner's line, in the round it got tangled, outlined in the tangler's colour
  const tangledBy = tanglers(turns)
  const tangleMarks: ChartMarker[] = game.tangled.flatMap((id) => {
    const turn = [...turns].reverse().find((t) => t.newlyTangled.includes(id))
    const owner = game.glyphlings.find((g) => g.id === id)?.seat
    if (!turn || owner === undefined) return []
    return [{ kind: 'tangle' as const, seat: owner, x: turn.round, turnNo: turn.turnNo, by: tangledBy.get(id), glyphling: id }]
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
  // No two markers on the same spot; tangles first, then lead changes
  const markers: ChartMarker[] = []
  for (const m of [...tangleMarks, ...leadMarks]) {
    if (markers.length >= maxMarkers) break
    if (markers.some((o) => o.seat === m.seat && o.x === m.x)) continue
    markers.push(m)
  }
  const max = Math.max(1, ...series.flatMap((s) => s.points))
  return { rounds, series, markers, max }
}

/** Marker `index` first, then any other markers drawn on top of it: the same round and nearly the same Magic
 *  (within `share` of the chart's height) — a finger can't pick between them, so the caption tells them all. */
export function markersNear(chart: StoryChart, index: number, share = 0.08): ChartMarker[] {
  const at = chart.markers[index]
  if (!at) return []
  const valueOf = (m: ChartMarker) => chart.series[m.seat].points[m.x]
  const near = chart.markers.filter((m, i) => i !== index && m.x === at.x && Math.abs(valueOf(m) - valueOf(at)) <= chart.max * share)
  return [at, ...near]
}
