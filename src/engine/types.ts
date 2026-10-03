// The shapes of everything the rules engine works with.
// A GameState is plain data (no functions, no Maps) so it can be copied, saved, and sent online as JSON.
import type { Hex } from './hex'

/** Seat colours, in turn order. Seat 0 is Yellow, seat 1 Blue, and so on. */
export const SEAT_COLOURS = ['yellow', 'blue', 'purple', 'pink'] as const
export type SeatColour = (typeof SEAT_COLOURS)[number]

/** The numbers from content/tuning/rules.json, copied into each game so a replay uses the same rules. */
export interface RuleNumbers {
  handSize: number
  minWordLength: number
  ownershipBonus: number
  tangleBonus: number
  tanglesToEnd: number
}

export interface GameConfig {
  /** How many players, 2–4. */
  players: number
  /** A board name from content/data/boards.json, e.g. "small". */
  boardName: string
  /** Random seed: the same seed + the same actions = the same game. */
  seed: number
  rules: RuleNumbers
}

export interface Glyphling {
  /** 0,1 = seat 0's pair; 2,3 = seat 1's pair; and so on (id = seat × 2 + which). */
  id: number
  seat: number
  hex: Hex
}

/** A planted runeblossom seed. `letter` is "A".."Z". */
export interface PlantedSeed {
  letter: string
  seat: number
}

/** One word made this turn, and the Magic it made. */
export interface MadeWord {
  /** How it's spelled, e.g. "QUIT". */
  word: string
  /** The seeds it's made of, in reading order. */
  hexes: Hex[]
  magic: number
}

/** What happened on the last completed turn (for the UI to show and animate). */
export interface TurnSummary {
  seat: number
  glyphlingId: number
  from: Hex
  to: Hex
  /** The seed cast, or null for a move-only turn. */
  letter: string | null
  target: Hex | null
  words: MadeWord[]
  magic: number
  /** How many seeds were drawn (draw after Magic; refill after a refresh). */
  drew: number
}

export type Phase = 'draft' | 'play' | 'refresh' | 'over'

// ─── THE GAME LOG (log.ts) — what happened, turn by turn, for the end screen (stats, awards, the chart). ───
// Kept by the engine as it plays, so every copy of the game (pass-and-play, the server, sims, snapshots) has it.
// It holds the secret running totals: the online server never sends it before the game is over (party/views.ts).

/** One word in the log: its seeds' letters and who owned each one. */
export interface LogWord {
  word: string
  /** Each seed's letter, in reading order ("Qu" is one seed). */
  letters: string[]
  /** The seat that owned each seed, in reading order. */
  owners: number[]
  magic: number
  /** The part of `magic` that came from the caster's own seeds (ownershipBonus each). */
  ownMagic: number
  /** Its seeds' hexes (hexKey), in reading order — and where in it the seed cast this turn sits (0 = first).
   *  Missing in logs written before 2026-10-02 (the Hijack and Bridge awards then can't be earned). */
  hexes?: string[]
  at?: number
}

/** Every glyphling's legal moves, by glyphling id: at the start of the turn, after the move, after the cast. */
export interface LogMobility {
  before: number[]
  afterMove: number[]
  afterCast: number[]
}

/** A spot a rival could have scored on: the best word one of their hand's seeds would have grown there. */
export interface LogBlock {
  seat: number
  magic: number
  /** The word(s), e.g. "GARDEN" or "TO + AT". */
  word: string
}

/** One completed turn (draft placements aren't turns). */
export interface LogTurn {
  /** 1, 2, 3… — the same as the game's turnCount after this turn. */
  turnNo: number
  /** 1, 2, 3… — a new round starts each time play comes back round to an earlier seat. */
  round: number
  seat: number
  glyphlingId: number
  from: Hex
  to: Hex
  /** The seed cast, or null for a move-only turn. */
  letter: string | null
  target: Hex | null
  words: LogWord[]
  magic: number
  /** How many seeds were set aside on a refresh (0 when there was no refresh, or Keep all). */
  refreshed: number
  /** True when this turn ended with a refresh (even Keep all). */
  refresh: boolean
  /** Every seat's Magic after this turn (before any end-of-game tangle bonus). */
  totalsAfter: number[]
  /** Glyphlings tangled after this turn; which of them just got tangled; which came free. */
  tangledAfter: number[]
  newlyTangled: number[]
  freed: number[]
  /** For each glyphling in newlyTangled, in the same order: the seat that COMPLETED the tangle — every hex next to
   *  it held that seat's pieces and nothing else — its seeds or its own glyphlings (Muzzy, 2026-10-02); no other seat's seed or glyphling; the board edge is ignored,
   *  and the glyphling isn't theirs — or null. Missing in logs written before complete tangles were recorded. */
  completeTangles?: { glyphling: number; by: number | null }[]
  // ── The skill awards' facts (insight.ts; missing in logs written before 2026-10-02 → those awards can't be earned) ──
  /** Legal moves of every glyphling before the move, after it, and after the cast (Lockdown, Pincer, Close call). */
  mobility?: LogMobility
  /** How many of the caster's own seeds the cast flew over (Through the hedge). */
  castOver?: number
  /** The best word a rival could have grown on the cast's hex next turn, had it stayed empty (Weed toss). */
  blocked?: LogBlock | null
}

/** One tangled glyphling at the end, and the bonus it gave each seat. */
export interface LogTangle {
  glyphling: number
  owner: number
  /** Magic each seat got from it (tangleBonus × its pieces next to it; always 0 for the owner). */
  bonus: number[]
  /** How many of each seat's pieces (seeds + glyphlings) were next to it. */
  pieces: number[]
}

/** How the game ended. */
export interface LogEnd {
  endedOnTurn: number
  /** The seat whose turn ended the game. */
  endedBy: number
  /** Did that turn tangle one of the ender's own glyphlings? */
  selfTangle: boolean
  tangles: LogTangle[]
  tangleMagic: number[]
  /** Final Magic, tangle bonus included. */
  totals: number[]
}

export interface GameLog {
  turns: LogTurn[]
  end: LogEnd | null
}

export interface GameState {
  config: GameConfig
  phase: Phase
  /** Whose turn it is (in the draft: who is placing). */
  current: number
  /** The snake draft order, e.g. [0,1,1,0], and how far through it we are. */
  draftOrder: number[]
  draftIndex: number
  glyphlings: Glyphling[]
  /** Planted seeds by hexKey ("q,r"). */
  seeds: Record<string, PlantedSeed>
  /** Each seat's seeds in hand. */
  hands: string[][]
  /** The bag, in draw order: seeds are drawn from the front. */
  bag: string[]
  /** Magic per seat (secret from other players in the UI). */
  magic: number[]
  /** Ids of glyphlings with no legal move, checked when the draft ends and after every turn. */
  tangled: number[]
  lastTurn: TurnSummary | null
  /** Tangle bonus each seat got at the end (all 0 until the game is over). */
  tangleMagic: number[]
  /** Seats with the most Magic once the game is over (ties share the win). */
  winners: number[]
  /** How many turns have been completed (draft placements not counted). */
  turnCount: number
  /** The random number generator's position, so the engine stays pure. */
  rng: number
  /** What happened each turn (log.ts). Missing in games saved before the log existed = an empty log. */
  log?: GameLog
  /** Facts about the turn in progress that only the log may keep (they read rivals' hands): set by applyTurn, written
   *  into the log and cleared by endTurn. Secret like the log — party/views.ts never sends it. */
  pendingLog?: { blocked: LogBlock | null } | null
}

/** Everything a seat can do. */
export type Action =
  | { type: 'draft'; hex: Hex }
  | {
      type: 'turn'
      glyphling: number
      to: Hex
      /** Which seed in hand to cast (index), or null to only move. */
      seed: number | null
      target: Hex | null
    }
  | {
      type: 'refresh'
      /** Hand indexes of the seeds to set aside (they go back into the bag after refilling). */
      setAside: number[]
    }

/** The official word list: word (upper case) → Zipf score (how common it is). */
export type WordList = ReadonlyMap<string, number>
