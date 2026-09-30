// Boards and rule numbers read from content/ JSON.
import boardsJson from '../../content/data/boards.json'
import rulesJson from '../../content/tuning/rules.json'
import { boardFromColumns, type Board } from './hex'
import type { RuleNumbers } from './types'

type BoardEntry = { name: string; columns: number[] }

const built = new Map<string, Board>()

/** The board called `name` in content/data/boards.json (built once, then remembered). */
export function getBoard(name: string): Board {
  const cached = built.get(name)
  if (cached) return cached
  const entry = (boardsJson as unknown as Record<string, BoardEntry | undefined>)[name]
  if (!entry || !Array.isArray(entry.columns)) throw new Error(`Unknown board "${name}"`)
  const board = boardFromColumns(entry.columns)
  built.set(name, board)
  return board
}

/** The default board for a player count (content/data/boards.json → defaultForPlayers). */
export function defaultBoardFor(players: number): string {
  const defaults = boardsJson.defaultForPlayers as Record<string, string>
  return defaults[String(players)] ?? 'large'
}

/** The rule numbers from content/tuning/rules.json. */
export function defaultRules(): RuleNumbers {
  return {
    handSize: rulesJson.handSize,
    minWordLength: rulesJson.minWordLength,
    ownershipBonus: rulesJson.ownershipBonus,
    tangleBonus: rulesJson.tangleBonus,
    tanglesToEnd: rulesJson.tanglesToEnd,
  }
}

/** Every board in content/data/boards.json (its entries that have columns), e.g. ["small", "large"]. */
export const boardNames = (): string[] =>
  Object.entries(boardsJson).filter(([, entry]) => Array.isArray((entry as { columns?: unknown }).columns)).map(([name]) => name)
