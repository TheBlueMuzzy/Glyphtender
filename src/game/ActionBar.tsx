// THE BUTTONS under the tray — change with the moment:
//   play:    Shuffle · Undo · "Cast · +N" (N = Magic from THIS cast only; totals stay secret) or End turn
//            (word indicators off: plain "Cast" — the +N would tell you a word is there)
//            (Retry instead of Cast if the word list couldn't be loaded — End turn never needs it)
//   refresh: Keep all · Refresh N
//   over:    Skip (while the Magic reveal plays) → then Results · New game
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { revealSteps } from '../store/revealPlan'
import { Button, Row, fill, screens } from '../ui/kit'
import { wordListUrl } from './art'
import { usePreview } from './usePreview'

const w = text.game.buttons

/** size: how tall the buttons are, in px — about a board hex (finger-sized, like a glyphling), never below 44. */
export function ActionBar({ onNewGame, size }: { onNewGame: () => void; size: number }) {
  const s = useGameStore()
  const preview = usePreview()
  const game = s.game!
  if (game.phase === 'draft') return null
  // Online: another device's turn, or my move is on its way to the server — the buttons wait
  const notNow = s.waiting || (s.online !== null && s.online.mySeat !== game.current)

  if (game.phase === 'refresh') {
    const refreshing = notNow || s.refreshFx !== null // (the refresh playing out on the tray)
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button size={size} variant="secondary" disabled={refreshing} onClick={() => s.refresh(true)}>{w.keepAll}</Button>
        <Button size={size} disabled={refreshing || s.setAside.length === 0} onClick={() => s.refresh()}>{fill(w.refresh, { n: s.setAside.length })}</Button>
      </Row>
    )
  }

  if (game.phase === 'over') {
    // While the Magic reveal plays: only Skip. After it: Results (the end table) + New game.
    if (s.revealAt === null || s.revealAt < revealSteps(game).length) {
      return <Row gap="s" justify="center" className="game-actions"><Button size={size} variant="secondary" onClick={s.skipReveal}>{w.skip}</Button></Row>
    }
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button size={size} variant="secondary" onClick={() => screens.push('gameOver')}>{w.results}</Button>
        <Button size={size} onClick={onNewGame}>{w.newGame}</Button>
      </Row>
    )
  }

  // (online, another player's replayed plan is on the board — it's not mine to preview)
  const moveOnly = !notNow && !s.cast && mayMoveOnly(game, s.move)
  // a seed in the air, the device being passed on, my refresh's new seeds still growing (online), or not my turn online
  const busy = s.flying || s.handoff !== null || s.refreshFx !== null || notNow
  // The word list couldn't be loaded: a cast can't be scored, so the main button fetches it again
  if (!moveOnly && s.wordsStatus === 'failed') {
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button size={size} variant="ghost" disabled={busy} onClick={s.shuffleTray}>{w.shuffle}</Button>
        <Button size={size} variant="secondary" disabled={busy || (!s.move && !s.cast)} onClick={s.undo}>{w.undo}</Button>
        <Button size={size} onClick={() => s.loadWords(wordListUrl())}>{w.retryWords}</Button>
      </Row>
    )
  }
  const showMagic = preview && !notNow && (s.options?.wordIndicators ?? true)
  const castLabel = moveOnly ? w.endTurn : showMagic ? fill(w.castMagic, { n: preview.magic }) : w.cast
  return (
    <Row gap="s" justify="center" className="game-actions">
      <Button size={size} variant="ghost" disabled={busy} onClick={s.shuffleTray}>{w.shuffle}</Button>
      <Button size={size} variant="secondary" disabled={busy || (!s.move && !s.cast)} onClick={s.undo}>{w.undo}</Button>
      <Button size={size} disabled={busy || !(s.cast || moveOnly) || (s.cast !== null && !preview)} onClick={s.startCast}>{castLabel}</Button>
    </Row>
  )
}
