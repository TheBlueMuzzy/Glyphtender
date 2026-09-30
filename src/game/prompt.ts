// What the turn bar says: whose turn, and what to do next. Words from content/text/en.json → game.
import text from '../../content/text/en.json'
import type { GameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { revealSteps, revealView } from '../store/revealPlan'
import type { GameState } from '../engine/types'
import { fill } from '../ui/kit'
import { colourOf } from './art'

const w = text.game

/** The current player's name, e.g. "Yellow". */
export const playerName = (seat: number) => w.players[colourOf(seat)]

type PromptState = Pick<GameStore, 'game' | 'move' | 'cast' | 'selected' | 'flying' | 'note' | 'wordsStatus' | 'handoff' | 'revealAt'>

/** The main line and a smaller line under it (whose turn / a hint). */
export function promptFor(s: PromptState): { text: string; detail: string } {
  const game = s.game
  if (!game) return { text: '', detail: '' }
  const player = playerName(game.current)
  const turnOf = fill(w.turnOf, { player })
  if (game.phase === 'over') return { text: revealPrompt(game, s.revealAt), detail: '' }
  if (game.phase === 'draft') {
    const placed = game.glyphlings.filter((g) => g.seat === game.current).length
    return { text: fill(w.prompts.draft, { player, n: placed + 1, total: 2 }), detail: '' }
  }
  if (s.handoff) return { text: fill(w.prompts.handoff, { player: playerName(s.handoff.seat) }), detail: '' }
  if (game.phase === 'refresh') return { text: w.prompts.refresh, detail: w.prompts.refreshDetail }
  const hint = s.note ? w.notes[s.note] : turnOf
  if (s.flying) return { text: w.prompts.flying, detail: turnOf }
  if (s.selected?.kind === 'glyphling') return { text: w.prompts.moveHeld, detail: hint }
  if (s.selected?.kind === 'seed') return { text: w.prompts.castHeld, detail: hint }
  if (s.cast) return { text: s.wordsStatus === 'ready' ? w.prompts.ready : w.prompts.loading, detail: hint }
  if (s.move) return { text: mayMoveOnly(game, s.move) ? w.prompts.moveOnly : w.prompts.cast, detail: hint }
  return { text: w.prompts.move, detail: hint }
}

/** The turn bar during the Magic reveal: what's being revealed, then the winner(s). */
function revealPrompt(game: GameState, at: number | null): string {
  const view = revealView(revealSteps(game), at)
  const r = w.reveal
  if (view.announced) return winnerTitle(game)
  if (view.current?.kind === 'bonus') return fill(r.bonus, { n: view.current.amount, player: playerName(view.current.seat) })
  if (view.current?.kind === 'count') return fill(r.counting, { player: playerName(view.current.seat) })
  return r.tangles
}

/** Whose portrait the turn bar shows: the player to move — or, during the reveal, whose Magic is counting, then the winner. */
export function promptSeat(s: PromptState): number {
  const game = s.game
  if (!game) return 0
  if (s.handoff) return s.handoff.seat
  if (game.phase !== 'over') return game.current
  const view = revealView(revealSteps(game), s.revealAt)
  if (view.announced) return game.winners[0] ?? game.current
  if (view.current?.kind === 'count') return view.current.seat
  if (view.current?.kind === 'bonus') return view.current.seat
  return game.current
}

/** "Grand Glyphtender: Yellow!" — or, for a shared win, "Grand Glyphtenders: Yellow & Blue!" */
export function winnerTitle(game: GameState): string {
  const names = game.winners.map(playerName).join(w.reveal.and)
  return fill(game.winners.length > 1 ? w.reveal.winners : w.reveal.winner, { names })
}
