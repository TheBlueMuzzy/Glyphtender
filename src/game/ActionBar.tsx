// THE BUTTONS under the tray — change with the moment:
//   play:    Shuffle · Undo · "Cast · +N" (N = Magic from THIS cast only; totals stay secret) or End turn
//   refresh: Keep all · Refresh N
//   over:    Results · Play again
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { mayMoveOnly } from '../store/turnPlan'
import { Button, Row, fill, screens } from '../ui/kit'
import { usePreview } from './usePreview'

const w = text.game.buttons

export function ActionBar({ onPlayAgain }: { onPlayAgain: () => void }) {
  const s = useGameStore()
  const preview = usePreview()
  const game = s.game!
  if (game.phase === 'draft') return null

  if (game.phase === 'refresh') {
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button variant="secondary" onClick={() => s.refresh(true)}>{w.keepAll}</Button>
        <Button disabled={s.setAside.length === 0} onClick={() => s.refresh()}>{fill(w.refresh, { n: s.setAside.length })}</Button>
      </Row>
    )
  }

  if (game.phase === 'over') {
    return (
      <Row gap="s" justify="center" className="game-actions">
        <Button variant="secondary" onClick={() => screens.push('gameOver')}>{w.results}</Button>
        <Button onClick={onPlayAgain}>{w.playAgain}</Button>
      </Row>
    )
  }

  const moveOnly = !s.cast && mayMoveOnly(game, s.move)
  const castLabel = moveOnly ? w.endTurn : preview ? fill(w.castMagic, { n: preview.magic }) : w.cast
  return (
    <Row gap="s" justify="center" className="game-actions">
      <Button variant="ghost" disabled={s.flying} onClick={s.shuffleTray}>{w.shuffle}</Button>
      <Button variant="secondary" disabled={s.flying || (!s.move && !s.cast)} onClick={s.undo}>{w.undo}</Button>
      <Button disabled={s.flying || !(s.cast || moveOnly) || (s.cast !== null && !preview)} onClick={s.startCast}>{castLabel}</Button>
    </Row>
  )
}
