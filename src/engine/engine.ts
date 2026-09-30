// The one door into the rules: applyAction(state, action, words) → the next state.
// It never changes the state it's given. Illegal actions throw an Error saying why
// (checkAction gives the same reason without throwing, for the UI).
// Also for the UI: legalDraftHexes, legalMoves, legalCasts, previewTurn, seedMagic (re-exported below).
import { applyDraft, checkDraft } from './draft'
import { applyRefresh, checkRefresh } from './refresh'
import { applyTurn, checkTurn } from './turn'
import type { Action, GameState, WordList } from './types'

/** Why `action` isn't allowed right now, or null if it is. */
export function checkAction(state: GameState, action: Action): string | null {
  switch (action.type) {
    case 'draft':
      return checkDraft(state, action.hex)
    case 'turn':
      return checkTurn(state, action)
    case 'refresh':
      return checkRefresh(state, action.setAside)
    default:
      return `Unknown action`
  }
}

/** Plays one action and returns the new state. Throws an Error if the action is illegal. */
export function applyAction(state: GameState, action: Action, words: WordList): GameState {
  switch (action.type) {
    case 'draft':
      return applyDraft(state, action.hex)
    case 'turn':
      return applyTurn(state, action, words)
    case 'refresh':
      return applyRefresh(state, action.setAside)
    default:
      throw new Error(`Unknown action`)
  }
}

export { legalDraftHexes } from './draft'
export { legalMoves, legalCasts } from './moves'
export { previewTurn, seedMagic } from './turn'
export { newGame } from './setup'
