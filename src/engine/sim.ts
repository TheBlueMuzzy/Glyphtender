// A random-legal-player simulation: plays whole games by picking random legal actions,
// checking the rules' promises after every action. Used by tests and `npm run sim`.
import { hexKey, type Hex } from './hex'
import { legalDraftHexes } from './draft'
import { applyAction, previewTurn } from './engine'
import { legalCasts, legalMoves } from './moves'
import { randomInt } from './rng'
import { fullBag, newGame } from './setup'
import type { Action, GameState, WordList } from './types'

export interface SimOptions {
  players: number
  boardName: string
  seed: number
  words: WordList
  /** Stop and fail if a game takes more turns than this. */
  maxTurns?: number
  /** 'random' plays any legal action; 'greedy' tries 20 random turns and plays the one making the most Magic. */
  player?: PlayerStyle
}

export type PlayerStyle = 'random' | 'greedy'

export interface SimResult {
  turns: number
  winners: number[]
  magic: number[]
  /** Did the bag ever run empty? */
  bagRanOut: boolean
  /** Was the game ended by a player tangling one of their own glyphlings? */
  selfTangle: boolean
  /** How many turns made at least one word. */
  scoringTurns: number
  /** What happened to the Q seed: cast onto the board, part of a word that made Magic, set aside in a refresh, still in a hand at the end. */
  q: { cast: boolean; scored: boolean; refreshed: boolean; stuck: boolean }
}

/** Is this the Q seed? */
const isQ = (letter: string | null) => letter === 'Q'

/** Picks one random legal action for whoever's turn it is. */
export function randomAction(state: GameState, rng: number): { action: Action; rng: number } {
  let pos = rng
  const pick = <T>(list: T[]): T => {
    const r = randomInt(pos, list.length)
    pos = r.rng
    return list[r.value]
  }
  if (state.phase === 'draft') return { action: { type: 'draft', hex: pick(legalDraftHexes(state)) }, rng: pos }
  if (state.phase === 'refresh') {
    // Set aside each seed with a 1-in-3 chance.
    const setAside = state.hands[state.current].flatMap((_, i) => (pick([0, 1, 2]) === 0 ? [i] : []))
    return { action: { type: 'refresh', setAside }, rng: pos }
  }
  const mine = state.glyphlings.filter((g) => g.seat === state.current && legalMoves(state, g.id).length > 0)
  if (mine.length === 0) throw new Error(`Seat ${state.current} has no glyphling that can move, but the game is not over`)
  const g = pick(mine)
  const to: Hex = pick(legalMoves(state, g.id))
  const hand = state.hands[state.current]
  const casts = legalCasts(state, g.id, to)
  if (hand.length === 0 || casts.length === 0) return { action: { type: 'turn', glyphling: g.id, to, seed: null, target: null }, rng: pos }
  const seed = pick(hand.map((_, i) => i))
  return { action: { type: 'turn', glyphling: g.id, to, seed, target: pick(casts) }, rng: pos }
}

/** Tries `tries` random turns and keeps the one that makes the most Magic (drafts and refreshes stay random). */
export function greedyAction(state: GameState, rng: number, words: WordList, tries = 20): { action: Action; rng: number } {
  let best = randomAction(state, rng)
  if (best.action.type !== 'turn') return best
  let bestMagic = previewTurn(state, best.action, words).magic
  let pos = best.rng
  for (let i = 1; i < tries; i++) {
    const next = randomAction(state, pos)
    pos = next.rng
    if (next.action.type !== 'turn') continue
    const magic = previewTurn(state, next.action, words).magic
    if (magic > bestMagic) {
      best = next
      bestMagic = magic
    }
  }
  return { action: best.action, rng: pos }
}

/** Seeds in the bag + all hands + on the board. Must always be 120. */
export const seedTotal = (s: GameState) => s.bag.length + s.hands.reduce((n, h) => n + h.length, 0) + Object.keys(s.seeds).length

/** Throws if a rule promise is broken between `before` and `after` (the action that was just played). */
export function checkInvariants(before: GameState, action: Action, after: GameState): void {
  const total = fullBag().length
  if (seedTotal(after) !== total) throw new Error(`Seed count is ${seedTotal(after)}, should be ${total}`)
  for (const hand of after.hands) if (hand.length > after.config.rules.handSize) throw new Error(`A hand has ${hand.length} seeds`)
  const glyphlingHexes = after.glyphlings.map((g) => hexKey(g.hex))
  if (new Set(glyphlingHexes).size !== glyphlingHexes.length) throw new Error('Two glyphlings share a hex')
  if (glyphlingHexes.some((k) => after.seeds[k])) throw new Error('A glyphling stands on a seed')
  const next = (before.current + 1) % before.config.players
  if (action.type === 'turn' && after.phase === 'play' && after.current !== next) throw new Error('Turn order broken after a turn')
  if (action.type === 'turn' && after.phase === 'refresh' && after.current !== before.current) throw new Error('Refresh went to the wrong seat')
  if (action.type === 'refresh' && after.phase === 'play' && after.current !== next) throw new Error('Turn order broken after a refresh')
  if (action.type === 'draft' && after.phase === 'draft' && after.current !== after.draftOrder[after.draftIndex]) throw new Error('Draft order broken')
}

/** Plays one whole game with random legal actions. Throws if a rule promise breaks or the game never ends. */
export function simulateGame(options: SimOptions): SimResult {
  const maxTurns = options.maxTurns ?? 1000
  let state = newGame({ players: options.players, boardName: options.boardName, seed: options.seed })
  let rng = options.seed ^ 0x5eed
  let bagRanOut = false
  let selfTangle = false
  let scoringTurns = 0
  const q = { cast: false, scored: false, refreshed: false, stuck: false }
  while (state.phase !== 'over') {
    if (state.turnCount > maxTurns) throw new Error(`Game did not end within ${maxTurns} turns (seed ${options.seed})`)
    const picked = options.player === 'greedy' ? greedyAction(state, rng, options.words) : randomAction(state, rng)
    rng = picked.rng
    const before = state
    state = applyAction(state, picked.action, options.words)
    checkInvariants(before, picked.action, state)
    if (state.phase !== 'draft' && state.bag.length === 0) bagRanOut = true
    if (picked.action.type === 'turn' && (state.lastTurn?.words.length ?? 0) > 0) scoringTurns++
    if (picked.action.type === 'turn' && isQ(state.lastTurn?.letter ?? null)) q.cast = true
    if (picked.action.type === 'turn' && state.lastTurn?.words.some((w) => w.hexes.some((h) => isQ(state.seeds[hexKey(h)]?.letter ?? null)))) q.scored = true
    if (picked.action.type === 'refresh' && picked.action.setAside.some((i) => isQ(before.hands[before.current][i]))) q.refreshed = true
    if (state.phase === 'over') {
      // Self-tangle: a glyphling of the seat who just played became tangled on this turn.
      const newly = state.tangled.filter((id) => !before.tangled.includes(id))
      selfTangle = newly.some((id) => state.glyphlings.find((g) => g.id === id)?.seat === state.lastTurn?.seat)
    }
  }
  q.stuck = state.hands.some((hand) => hand.some(isQ))
  return { turns: state.turnCount, winners: state.winners, magic: state.magic, bagRanOut, selfTangle, scoringTurns, q }
}

export interface SimSummary {
  player: PlayerStyle
  players: number
  boardName: string
  games: number
  avgTurns: number
  maxTurns: number
  bagRanOutPct: number
  selfTanglePct: number
  scoringTurnPct: number
  /** Share of games each seat won (ties count as a win for everyone tied). */
  seatWinPct: number[]
  /** Share of games where the Q seed was cast / was in a word that made Magic / was set aside in a refresh / was still in a hand at the end. */
  qCastPct: number
  qScoredPct: number
  qRefreshedPct: number
  qStuckPct: number
}

/** Plays `games` games and sums them up. */
export function simulateMany(players: number, boardName: string, games: number, words: WordList, player: PlayerStyle = 'random'): SimSummary {
  let turns = 0
  let longest = 0
  let bag = 0
  let self = 0
  let scoring = 0
  const wins: number[] = Array(players).fill(0)
  const qCount = { cast: 0, scored: 0, refreshed: 0, stuck: 0 }
  for (let i = 0; i < games; i++) {
    const r = simulateGame({ players, boardName, seed: i + 1, words, player })
    turns += r.turns
    longest = Math.max(longest, r.turns)
    if (r.bagRanOut) bag++
    if (r.selfTangle) self++
    scoring += r.scoringTurns
    for (const w of r.winners) wins[w]++
    for (const k of ['cast', 'scored', 'refreshed', 'stuck'] as const) if (r.q[k]) qCount[k]++
  }
  const pct = (n: number) => Math.round((1000 * n) / games) / 10
  return {
    player,
    players,
    boardName,
    games,
    avgTurns: Math.round((10 * turns) / games) / 10,
    maxTurns: longest,
    bagRanOutPct: pct(bag),
    selfTanglePct: pct(self),
    scoringTurnPct: Math.round((1000 * scoring) / Math.max(1, turns)) / 10,
    seatWinPct: wins.map(pct),
    qCastPct: pct(qCount.cast),
    qScoredPct: pct(qCount.scored),
    qRefreshedPct: pct(qCount.refreshed),
    qStuckPct: pct(qCount.stuck),
  }
}
