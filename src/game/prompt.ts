// What the turn bar says: whose turn, and what to do next. Words from content/text/en.json → game.
import text from '../../content/text/en.json'
import type { GameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { fill } from '../ui/kit'
import { colourOf } from './art'

const w = text.game

/** The current player's name, e.g. "Yellow". */
export const playerName = (seat: number) => w.players[colourOf(seat)]

type PromptState = Pick<GameStore, 'game' | 'move' | 'cast' | 'selected' | 'flying' | 'note' | 'wordsStatus'>

/** The main line and a smaller line under it (whose turn / a hint). */
export function promptFor(s: PromptState): { text: string; detail: string } {
  const game = s.game
  if (!game) return { text: '', detail: '' }
  const player = playerName(game.current)
  const turnOf = fill(w.turnOf, { player })
  if (game.phase === 'over') return { text: w.prompts.over, detail: '' }
  if (game.phase === 'draft') {
    const placed = game.glyphlings.filter((g) => g.seat === game.current).length
    return { text: fill(w.prompts.draft, { player, n: placed + 1, total: 2 }), detail: '' }
  }
  if (game.phase === 'refresh') return { text: w.prompts.refresh, detail: w.prompts.refreshDetail }
  const hint = s.note ? w.notes[s.note] : turnOf
  if (s.flying) return { text: w.prompts.flying, detail: turnOf }
  if (s.selected?.kind === 'glyphling') return { text: w.prompts.moveHeld, detail: hint }
  if (s.selected?.kind === 'seed') return { text: w.prompts.castHeld, detail: hint }
  if (s.cast) return { text: s.wordsStatus === 'ready' ? w.prompts.ready : w.prompts.loading, detail: hint }
  if (s.move) return { text: mayMoveOnly(game, s.move) ? w.prompts.moveOnly : w.prompts.cast, detail: hint }
  return { text: w.prompts.move, detail: hint }
}
