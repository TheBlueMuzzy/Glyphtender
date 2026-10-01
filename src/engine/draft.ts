// The snake draft: players take turns placing their glyphlings, then everyone is dealt a hand.
import { hexKey, isEdge, neighbours, type Hex } from './hex'
import { getBoard } from './boards'
import { includesHex } from './moves'
import { tangledIds } from './tangle'
import type { GameState } from './types'

/** Hexes a glyphling may be placed on: on the board, not an edge, empty, and not next to any glyphling. */
export function legalDraftHexes(state: GameState): Hex[] {
  if (state.phase !== 'draft') return []
  const board = getBoard(state.config.boardName)
  const placed = new Set(state.glyphlings.map((g) => hexKey(g.hex)))
  return board.cells.filter(
    (h) => !isEdge(board, h) && !placed.has(hexKey(h)) && !neighbours(board, h).some((n) => placed.has(hexKey(n))),
  )
}

/** Why this draft placement isn't allowed, or null if it is. */
export function checkDraft(state: GameState, hex: Hex): string | null {
  if (state.phase !== 'draft') return 'The draft is over'
  if (!includesHex(legalDraftHexes(state), hex)) return 'A glyphling must go on an empty inner hex, not next to another glyphling'
  return null
}

/** Places the current drafter's next glyphling. After the last one, deals hands and starts play. */
export function applyDraft(state: GameState, hex: Hex): GameState {
  const problem = checkDraft(state, hex)
  if (problem) throw new Error(problem)
  const seat = state.current
  const alreadyPlaced = state.glyphlings.filter((g) => g.seat === seat).length
  const glyphlings = [...state.glyphlings, { id: seat * 2 + alreadyPlaced, seat, hex: { ...hex } }]
  const draftIndex = state.draftIndex + 1
  if (draftIndex < state.draftOrder.length) {
    return { ...state, glyphlings, draftIndex, current: state.draftOrder[draftIndex] }
  }
  // Draft done: deal a full hand to each seat in seat order, from the front of the bag.
  const bag = [...state.bag]
  const hands = state.hands.map(() => bag.splice(0, state.config.rules.handSize))
  const started: GameState = { ...state, glyphlings, draftIndex, hands, bag, phase: 'play', current: 0 }
  // Who's stuck as play starts — the baseline the first turn's log compares with, so a glyphling that was already
  // stuck isn't credited as a tangle to the first player (a legal draft never boxes one in; hand-built positions can)
  return { ...started, tangled: tangledIds(started) }
}
