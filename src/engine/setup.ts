// Starting a new game: the shuffled bag and the snake draft order.
import bagJson from '../../content/data/bag.json'
import { defaultBoardFor, defaultRules, getBoard } from './boards'
import { emptyLog } from './log'
import { shuffle } from './rng'
import type { GameConfig, GameState, RuleNumbers } from './types'

/** Every seed in the bag (content/data/bag.json), unshuffled, e.g. ["A","A",…,"Q",…]. */
export function fullBag(): string[] {
  const seeds: string[] = []
  for (const [letter, count] of Object.entries(bagJson.seeds)) {
    for (let i = 0; i < count; i++) seeds.push(letter)
  }
  return seeds
}

/** Snake draft: 1-2-2-1 for 2 players, 1-2-3-3-2-1 for 3, 1-2-3-4-4-3-2-1 for 4 (as seat numbers from 0). */
export function snakeOrder(players: number): number[] {
  const forward = Array.from({ length: players }, (_, seat) => seat)
  return [...forward, ...forward.slice().reverse()]
}

export interface NewGameOptions {
  players: number
  seed: number
  /** Defaults to the board for this player count in boards.json. */
  boardName?: string
  /** Change any rule numbers (e.g. minWordLength 3); the rest come from content/tuning/rules.json. */
  rules?: Partial<RuleNumbers>
}

/** A fresh game in the draft phase: shuffled bag, nobody placed yet, no hands dealt. */
export function newGame(options: NewGameOptions): GameState {
  const { players, seed } = options
  if (!Number.isInteger(players) || players < 2 || players > 4) throw new Error(`Players must be 2–4, got ${players}`)
  const boardName = options.boardName ?? defaultBoardFor(players)
  getBoard(boardName) // throws if the board doesn't exist
  const config: GameConfig = { players, boardName, seed, rules: { ...defaultRules(), ...options.rules } }
  const shuffled = shuffle(seed, fullBag())
  return {
    config,
    phase: 'draft',
    current: 0,
    draftOrder: snakeOrder(players),
    draftIndex: 0,
    glyphlings: [],
    seeds: {},
    hands: Array.from({ length: players }, () => []),
    bag: shuffled.items,
    magic: Array(players).fill(0),
    tangled: [],
    lastTurn: null,
    tangleMagic: Array(players).fill(0),
    winners: [],
    turnCount: 0,
    rng: shuffled.rng,
    log: emptyLog(),
  }
}
