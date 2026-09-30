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

/** A planted runeblossom seed. `letter` is "A".."Z" or "Qu". */
export interface PlantedSeed {
  letter: string
  seat: number
}

/** One word made this turn, and the Magic it made. */
export interface MadeWord {
  /** How it's spelled, e.g. "QUIT" (a Qu seed spells "QU"). */
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
  /** Ids of glyphlings with no legal move, checked after every turn. */
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
