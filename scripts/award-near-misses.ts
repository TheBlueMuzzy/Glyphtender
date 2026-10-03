// AWARD NEAR-MISSES — for a saved game (a Dev Kit snapshot file), how close did each award come?
//   npx tsx scripts/award-near-misses.ts content/snapshots/<name>.json
// Prints, per award, the best moment in the game against its endscreen.json threshold — so "0 awards" can be told
// apart from "thresholds too high". Mirrors the rules in src/game/stats.ts earnedAwards (keep them in step).
import { readFileSync } from 'node:fs'
import endscreen from '../content/tuning/endscreen.json'
import { logOf } from '../src/engine/log'
import type { GameState } from '../src/engine/types'
import { earnedAwards, walledCells } from '../src/game/stats'

const file = process.argv[2]
if (!file) throw new Error('Usage: npx tsx scripts/award-near-misses.ts content/snapshots/<name>.json')
const snap = JSON.parse(readFileSync(file, 'utf8'))
const game: GameState = snap.state?.game ?? snap.game
const t = endscreen
const turns = logOf(game).turns
const seatsOf = (seat: number) => game.glyphlings.filter((g) => g.seat !== seat)
type Best = { value: number; where: string }
const best: Record<string, Best> = {}
const keep = (id: string, value: number, where: string) => { if (!best[id] || value > best[id].value) best[id] = { value, where } }

turns.forEach((turn) => {
  const at = `round ${turn.round} (seat ${turn.seat})`
  const m = turn.mobility
  if (m) {
    for (const g of seatsOf(turn.seat)) {
      const [from, mid, to] = [m.before[g.id], m.afterMove[g.id], m.afterCast[g.id]]
      if (from === undefined || mid === undefined || to === undefined) continue
      keep('lockdown: moves taken from one rival glyphling', from - to, `${at}: ${from} → ${to}`)
      keep('lockdown: …while leaving it ≤ ' + t.lockdownMaxAfter + ' (best drop that did)', to <= t.lockdownMaxAfter ? from - to : -1, `${at}: ${from} → ${to}`)
      keep('pincer: smaller of move-cut / cast-cut', Math.min(from - mid, mid - to), `${at}: ${from} → ${mid} → ${to}`)
    }
    for (const g of game.glyphlings.filter((x) => x.seat === turn.seat)) {
      if (m.before[g.id] === 1) keep('closeCall: moves after escaping from 1', m.afterCast[g.id] ?? 0, at)
    }
  }
  if (turn.letter !== null && turn.magic <= t.weedMaxMagic && turn.blocked) keep('weedToss: Magic blocked by a 0-Magic cast', turn.blocked.magic, at)
  if (turn.magic > 0) keep('throughHedge: own seeds flown over (scoring cast)', turn.castOver ?? 0, at)
  keep('powerPlay: words from one seed', turn.words.length, `${at}: ${turn.words.map((w) => w.word).join(', ')}`)
  for (const w of turn.words) {
    keep('longWord: letters', w.letters.length, `${at}: ${w.word}`)
    if (w.at !== undefined) keep('bridge: letters on the shorter side of the seed', Math.min(w.at, w.letters.length - 1 - w.at), `${at}: ${w.word}`)
  }
  keep('completeTangle: count', (turn.completeTangles ?? []).filter((c) => c.by !== null).length, at)
})
// walled gardens (stats.ts walledCells — whoever built the wall): Magic made inside from the turn it was small enough
for (const cell of walledCells(game, t.walledMaxSize)) {
  const key = (h: { q: number; r: number }) => `${h.q},${h.r}`
  let made = 0
  for (let j = cell.from; j < turns.length; j++) {
    const later = turns[j]
    if (later.seat === cell.seat && cell.hexes.has(key(later.to)) && (j === cell.from || cell.hexes.has(key(later.from)))) made += later.magic
  }
  keep('walledGarden: Magic made in a sealed pocket', made, `seat ${cell.seat}'s glyphling ${cell.glyphling}: ${cell.hexes.size} hexes from round ${turns[cell.from].round}`)
}
// comeback
turns.forEach((turn, i) => {
  const was = i > 0 ? turns[i - 1].totalsAfter : game.magic.map(() => 0)
  const others = (x: number[]) => Math.max(...x.filter((_, s) => s !== turn.seat))
  if (turn.totalsAfter[turn.seat] > others(turn.totalsAfter)) keep('comeback: deficit before a lead-taking turn', others(was) - was[turn.seat], `round ${turn.round} (seat ${turn.seat})`)
})
const end = logOf(game).end
const last = end && turns.find((x) => x.turnNo === end.endedOnTurn)
if (end && last) {
  const margin = last.totalsAfter[end.endedBy] - Math.max(...last.totalsAfter.filter((_, s) => s !== end.endedBy))
  keep('calledIt / trickster: ender\'s margin when they ended it (+ ahead, − behind)', margin, `seat ${end.endedBy} ended it; winners ${game.winners}`)
}

const need: Record<string, string> = {
  'lockdown: moves taken from one rival glyphling': `≥ ${t.lockdownMinDrop}`,
  ['lockdown: …while leaving it ≤ ' + t.lockdownMaxAfter + ' (best drop that did)']: `≥ ${t.lockdownMinDrop}`,
  'pincer: smaller of move-cut / cast-cut': `≥ ${t.pincerMinEach} each, from ≥ ${t.pincerMinFrom}, ≤ ${t.pincerMaxLeft * 100}% left`,
  'closeCall: moves after escaping from 1': `≥ ${t.closeCallMinAfter} (and never tangled)`,
  'weedToss: Magic blocked by a 0-Magic cast': `≥ ${t.weedMinBlocked}`,
  'walledGarden: Magic made in a sealed pocket': `≥ ${t.walledMinMagic} (pocket ≤ ${t.walledMaxSize} hexes)`,
  'throughHedge: own seeds flown over (scoring cast)': `≥ ${t.hedgeMinOver}`,
  'powerPlay: words from one seed': `≥ ${t.powerPlayMin}`,
  'longWord: letters': `≥ ${game.config.boardName === 'small' ? t.longWordMinSmall : t.longWordMinLarge}`,
  'bridge: letters on the shorter side of the seed': `≥ ${t.bridgeMinSide}`,
  'completeTangle: count': '≥ 1',
  'comeback: deficit before a lead-taking turn': 'the biggest, > 0',
  'calledIt / trickster: ender\'s margin when they ended it (+ ahead, − behind)': `≥ +${t.calledItMinLead} & won / ≤ −${t.tricksterMinBehind} & lost`,
}
console.log(`${game.config.players} players, ${game.config.boardName} garden, ${turns.length} turns, final ${game.magic.join(' / ')}`)
console.log(`log complete: ${turns.length > 0}, earned: ${earnedAwards(game).map((a) => a.id).join(', ') || 'none'}\n`)
for (const [id, b] of Object.entries(best)) console.log(`${id.padEnd(62)} best ${String(b.value).padStart(3)}  need ${need[id] ?? '?'}   — ${b.where}`)
for (const id of Object.keys(need)) if (!best[id]) console.log(`${id.padEnd(62)} never happened  need ${need[id]}`)
