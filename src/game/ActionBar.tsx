// THE BUTTONS under the tray — change with the moment:
//   play:    Shuffle · Undo · "Cast · +N" (N = Magic from THIS cast only; totals stay secret) or End turn
//            (word indicators off: plain "Cast" — the +N would tell you a word is there)
//            (Retry instead of Cast if the word list couldn't be loaded — End turn never needs it)
//   refresh: Keep all · Refresh N
//   over:    Skip (while the Magic reveal plays) — a normal-size button, not a board-hex one (the reveal is calm,
//            centred: Muzzy at 768×343). After the reveal there's no ActionBar: the end bar (EndBar.tsx — ☰ · See
//            results · New game) sits at the bottom, in the very same spot as on the end screen.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { revealSteps } from '../store/revealPlan'
import { Button, Row, fill } from '../ui/kit'
import { wordListUrl } from './art'
import { usePreview } from './usePreview'
import { Ghost } from './PromptLine'

const w = text.game.buttons

/** size: how tall the buttons are, in px — about a board hex (finger-sized, like a glyphling), never below 44.
 *  fixed: hold the space for the tallest row of buttons the game can show (B013) — hidden copies of every row,
 *  with the longest labels, are piled behind the real one. On a narrow phone "Cast · +3" can wrap the row onto
 *  2 lines while "Keep all · Refresh" fits on 1; without this the board would jump each time.
 *  In portrait the buttons are also compact (kit: less room each side of the label), so the longest row,
 *  "Shuffle · Undo · Cast · +88", fits ONE line on a 360-wide phone — no second row of space held under them. */
export function ActionBar({ size, fixed }: { size: number; fixed: boolean }) {
  const phase = useGameStore((s) => s.game!.phase)
  if (phase === 'draft') return null
  return (
    <div className="game-actions-pile">
      {fixed && (
        <div className="game-actions-sizer" aria-hidden="true" inert>
          <Row gap="s" justify="center">
            <Button size={size} compact={fixed} variant="ghost"><Ghost words={w.shuffle} /></Button>
            <Button size={size} compact={fixed} variant="secondary"><Ghost words={w.undo} /></Button>
            <Button size={size} compact={fixed}><Ghost words={fill(w.castMagic, { n: 88 })} /></Button>
          </Row>
          <Row gap="s" justify="center">
            <Button size={size} compact={fixed} variant="ghost"><Ghost words={w.shuffle} /></Button>
            <Button size={size} compact={fixed} variant="secondary"><Ghost words={w.undo} /></Button>
            <Button size={size} compact={fixed}><Ghost words={w.endTurn} /></Button>
          </Row>
          <Row gap="s" justify="center">
            <Button size={size} compact={fixed} variant="secondary"><Ghost words={w.keepAll} /></Button>
            <Button size={size} compact={fixed}><Ghost words={fill(w.refresh, { n: 8 })} /></Button>
          </Row>
        </div>
      )}
      <ActionRow size={size} fixed={fixed} />
    </div>
  )
}

/** The real buttons for this moment. */
function ActionRow({ size, fixed }: { size: number; fixed: boolean }) {
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
        <Button size={size} compact={fixed} variant="secondary" disabled={refreshing} onClick={() => s.refresh(true)}>{w.keepAll}</Button>
        <Button size={size} compact={fixed} disabled={refreshing || s.setAside.length === 0} onClick={() => s.refresh()}>{fill(w.refresh, { n: s.setAside.length })}</Button>
      </Row>
    )
  }

  if (game.phase === 'over') {
    // While the Magic reveal plays: only Skip, normal size. After it: nothing here (the end bar — GameScreen.tsx)
    if (s.revealAt === null || s.revealAt < revealSteps(game).length) {
      return <Row gap="s" justify="center" className="game-actions"><Button variant="secondary" onClick={s.skipReveal}>{w.skip}</Button></Row>
    }
    return null
  }

  // (online, another player's replayed plan is on the board — it's not mine to preview)
  const moveOnly = !notNow && !s.cast && mayMoveOnly(game, s.move)
  // a seed in the air, the device being passed on, my refresh's new seeds still growing (online), or not my turn online
  const busy = s.flying || s.handoff !== null || s.refreshFx !== null || notNow
  // The word list couldn't be loaded: a cast can't be scored, so the main button fetches it again
  if (!moveOnly && s.wordsStatus === 'failed') {
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button size={size} compact={fixed} variant="ghost" disabled={busy} onClick={s.shuffleTray}>{w.shuffle}</Button>
        <Button size={size} compact={fixed} variant="secondary" disabled={busy || (!s.move && !s.cast)} onClick={s.undo}>{w.undo}</Button>
        <Button size={size} compact={fixed} onClick={() => s.loadWords(wordListUrl())}>{w.retryWords}</Button>
      </Row>
    )
  }
  const showMagic = preview && !notNow && (s.options?.wordIndicators ?? true)
  const castLabel = moveOnly ? w.endTurn : showMagic ? fill(w.castMagic, { n: preview.magic }) : w.cast
  return (
    <Row gap="s" justify="center" className="game-actions">
      <Button size={size} compact={fixed} variant="ghost" disabled={busy} onClick={s.shuffleTray}>{w.shuffle}</Button>
      <Button size={size} compact={fixed} variant="secondary" disabled={busy || (!s.move && !s.cast)} onClick={s.undo}>{w.undo}</Button>
      <Button size={size} compact={fixed} disabled={busy || !(s.cast || moveOnly) || (s.cast !== null && !preview)} onClick={s.startCast}>{castLabel}</Button>
    </Row>
  )
}
