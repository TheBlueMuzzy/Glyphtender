// What the turn bar says: whose turn, and what to do next. Words from content/text/en.json → game.
import text from '../../content/text/en.json'
import { useGameStore, type GameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { revealSteps, revealView } from '../store/revealPlan'
import type { GameState } from '../engine/types'
import { fill } from '../ui/kit'
import { colourOf } from './art'

const w = text.game

/** A player's name: their colour ("Yellow") on one device; online, the name they typed in the lobby. */
export const playerName = (seat: number) => useGameStore.getState().seats[seat]?.name ?? w.players[colourOf(seat)]

type PromptState = Pick<GameStore, 'game' | 'move' | 'cast' | 'selected' | 'flying' | 'note' | 'wordsStatus' | 'handoff' | 'revealAt'>
  & Partial<Pick<GameStore, 'seats'>>

/** The main line and a smaller line under it (whose turn / a hint). */
export function promptFor(s: PromptState): { text: string; detail: string } {
  const game = s.game
  if (!game) return { text: '', detail: '' }
  const player = playerName(game.current)
  const turnOf = fill(w.turnOf, { player })
  if (game.phase === 'over') return { text: revealPrompt(game, s.revealAt), detail: '' }
  // Online, another device's turn: say what they're doing (their glide and throw replay on the board)
  if (s.seats?.[game.current]?.kind === 'online') {
    const doing = game.phase === 'draft' ? w.prompts.othersDraft : game.phase === 'refresh' ? w.prompts.othersRefresh : w.prompts.othersTurn
    return { text: fill(doing, { player }), detail: '' }
  }
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
  if (s.cast) {
    const text = s.wordsStatus === 'ready' ? w.prompts.ready : s.wordsStatus === 'failed' ? w.prompts.wordsFailed : w.prompts.loading
    return { text, detail: hint }
  }
  if (s.move) return { text: mayMoveOnly(game, s.move) ? w.prompts.moveOnly : w.prompts.cast, detail: hint }
  return { text: w.prompts.move, detail: hint }
}

/**
 * Every main line and every small line the prompt can show in this game, filled in with these players' names —
 * the prompt's frame is as tall as the tallest of them at the screen's width, so the board never moves when the
 * words change (B013). Long fill-ins on purpose: the longest name, the biggest numbers, every winner at once.
 */
export function promptSizers(names: string[]): { texts: string[]; detail: string[] } {
  const player = names.reduce((a, b) => (b.length > a.length ? b : a), '')
  const p = w.prompts, r = w.reveal
  const turnPrompts = [p.move, p.moveHeld, p.cast, p.castHeld, p.ready, p.moveOnly, p.flying, p.refresh, p.loading, p.wordsFailed]
  const withName = [p.draft, p.handoff, p.othersTurn, p.othersDraft, p.othersRefresh, r.bonus, r.counting]
  return {
    texts: [
      ...turnPrompts, r.tangles,
      ...withName.map((t) => fill(t, { player, n: 10, total: 2 })),
      fill(r.winner, { names: player }), fill(r.winners, { names: names.join(r.and) }),
    ],
    detail: [...Object.values(w.notes), p.refreshDetail, fill(w.turnOf, { player })],
  }
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

/** Whose glyphling sits beside the prompt (so it's obvious who the words are for): the player to move (or the one the
 *  device is passed to), online the other player whose turn it is too; during the reveal, whose Magic is counting, then
 *  the winner. null = nobody in particular (the tangles being revealed, a shared win) — the spot stays, empty. */
export function promptIconSeat(s: PromptState): number | null {
  const game = s.game
  if (!game) return null
  if (game.phase !== 'over') return promptSeat(s)
  const view = revealView(revealSteps(game), s.revealAt)
  if (view.announced) return game.winners.length === 1 ? game.winners[0] : null
  if (view.current?.kind === 'count' || view.current?.kind === 'bonus') return view.current.seat
  return null
}

/** "Grand Glyphtender: Yellow!" — or, for a shared win, "Grand Glyphtenders: Yellow & Blue!" */
export function winnerTitle(game: GameState): string {
  const names = game.winners.map(playerName).join(w.reveal.and)
  return fill(game.winners.length > 1 ? w.reveal.winners : w.reveal.winner, { names })
}
