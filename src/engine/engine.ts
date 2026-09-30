// The one door into the rules: applyAction(state, action, words) → the next state.
// It never changes the state it's given. Illegal actions throw an Error saying why
// (checkAction gives the same reason without throwing, for the UI).
import { applyDraft, checkDraft } from './draft'
import { applyTurn, checkTurn } from './turn'
import type { Action, GameState, WordList } from './types'

/** Why `action` isn't allowed right now, or null if it is. */
export function checkAction(state: GameState, action: Action, _words: WordList): string | null {
  switch (action.type) {
    case 'draft':
      return checkDraft(state, action.hex)
    case 'turn':
      return checkTurn(state, action)
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
    default:
      throw new Error(`Unknown action`)
  }
}
