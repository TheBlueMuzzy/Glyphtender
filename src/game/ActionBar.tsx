// THE BUTTONS under the tray — change with the moment:
//   play:    Shuffle · Undo · "Cast · +N" (N = Magic from THIS cast only; totals stay secret) or End turn
//            (word indicators off: plain "Cast" — the +N would tell you a word is there)
//            (Retry instead of Cast if the word list couldn't be loaded — End turn never needs it)
//   refresh: Keep all · Refresh N
//   over:    Skip (while the Magic reveal plays) → then See results (reopens the end screen, which See board closed) · New game
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { revealSteps } from '../store/revealPlan'
import { Button, Row, fill, screens } from '../ui/kit'
import { wordListUrl } from './art'
import { usePreview } from './usePreview'
import { Ghost } from './PromptLine'

const w = text.game.buttons

/** size: how tall the buttons are, in px — about a board hex (finger-sized, like a glyphling), never below 44.
 *  fixed: hold the space for the tallest row of buttons the game can show (B013) — hidden copies of every row,
 *  with the longest labels, are piled behind the real one. On a narrow phone "Cast · +3" can wrap the row onto
 *  2 lines while "Keep all · Refresh" fits on 1; without this the board would jump each time. */
export function ActionBar({ onNewGame, size, fixed }: { onNewGame: () => void; size: number; fixed: boolean }) {
  const phase = useGameStore((s) => s.game!.phase)
  if (phase === 'draft') return null
  return (
    <div className="game-actions-pile">
      {fixed && (
        <div className="game-actions-sizer" aria-hidden="true" inert>
          <Row gap="s" justify="center">
            <Button size={size} variant="ghost"><Ghost words={w.shuffle} /></Button>
            <Button size={size} variant="secondary"><Ghost words={w.undo} /></Button>
            <Button size={size}><Ghost words={fill(w.castMagic, { n: 88 })} /></Button>
          </Row>
          <Row gap="s" justify="center">
            <Button size={size} variant="ghost"><Ghost words={w.shuffle} /></Button>
            <Button size={size} variant="secondary"><Ghost words={w.undo} /></Button>
            <Button size={size}><Ghost words={w.endTurn} /></Button>
          </Row>
          <Row gap="s" justify="center">
            <Button size={size} variant="secondary"><Ghost words={w.keepAll} /></Button>
            <Button size={size}><Ghost words={fill(w.refresh, { n: 8 })} /></Button>
          </Row>
          <Row gap="s" justify="center">
            <Button size={size} variant="secondary"><Ghost words={w.results} /></Button>
            <Button size={size}><Ghost words={w.newGame} /></Button>
          </Row>
        </div>
      )}
      <ActionRow onNewGame={onNewGame} size={size} />
    </div>
  )
}

/** The real buttons for this moment. */
function ActionRow({ onNewGame, size }: { onNewGame: () => void; size: number }) {
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
    // While the Magic reveal plays: only Skip. After it: See results (the end screen) + New game.
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
