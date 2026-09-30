// Helpers for tests: build small hand-made board positions using Muzzy's hex labels ("C6-3").
import { getBoard } from './boards'
import { hexKey, type Hex } from './hex'
import { newGame } from './setup'
import type { GameState, RuleNumbers } from './types'

/** The hex with designer label `label` (e.g. "C6-3") on a board. Throws if there's no such hex. */
export function hexAt(label: string, boardName = 'small'): Hex {
  const board = getBoard(boardName)
  const hex = board.cells.find((h) => board.label(h) === label)
  if (!hex) throw new Error(`No hex ${label} on the ${boardName} board`)
  return hex
}

/** Seeds to place: label → letter, owned by `seat`. */
export type SeedPlan = Record<string, string>

export interface PositionPlan {
  players?: number
  boardName?: string
  rules?: Partial<RuleNumbers>
  /** Glyphlings by id → label, e.g. { 0: 'C3-4', 1: 'C9-4', 2: 'C6-2', 3: 'C6-8' }. Seat = floor(id / 2). */
  glyphlings: Record<number, string>
  /** Seeds per seat, e.g. [{ 'C6-3': 'A' }, { 'C6-4': 'T' }]. */
  seeds?: SeedPlan[]
  /** Hands per seat; missing seats get an empty hand. */
  hands?: string[][]
  /** The bag (front = next draw). Defaults to empty. */
  bag?: string[]
  current?: number
}

/** A game in the play phase with exactly the pieces asked for — nothing else on the board. */
export function position(plan: PositionPlan): GameState {
  const players = plan.players ?? 2
  const boardName = plan.boardName ?? 'small'
  const base = newGame({ players, seed: 1, boardName, rules: plan.rules })
  const glyphlings = Object.entries(plan.glyphlings).map(([id, label]) => ({
    id: Number(id),
    seat: Math.floor(Number(id) / 2),
    hex: hexAt(label, boardName),
  }))
  const seeds: GameState['seeds'] = {}
  const seedPlans = plan.seeds ?? []
  seedPlans.forEach((perSeat, seat) => {
    for (const [label, letter] of Object.entries(perSeat)) seeds[hexKey(hexAt(label, boardName))] = { letter, seat }
  })
  const hands = Array.from({ length: players }, (_, seat) => [...(plan.hands?.[seat] ?? [])])
  return {
    ...base,
    phase: 'play',
    draftIndex: base.draftOrder.length,
    current: plan.current ?? 0,
    glyphlings,
    seeds,
    hands,
    bag: [...(plan.bag ?? [])],
  }
}

/** A tiny word list for tests. */
export const wordsOf = (...list: string[]) => new Map(list.map((w) => [w, 1]))
