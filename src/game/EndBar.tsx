// THE END BAR — Menu (☰) · See board / See results · New game, at the bottom of the screen once the game is over.
// ONE bar for both views (Muzzy, 2026-10-01: "I want to be able to tap in the same place to cause a switch between
// board/score"): the end screen (GameOver.tsx) shows it with "See board", the finished garden (GameScreen.tsx) with
// "See results" — same component, same sizes, same order, and the bottom row of both views with the same side
// padding (game.css), so the middle button never moves. e2e:end checks the rectangles match at every size.
// Room under the buttons for the phone's gesture edge: layout.json bottomRoom (as in the game).
// Kit parts: Button.
import text from '../../content/text/en.json'
import { Button, screens } from '../ui/kit'
import { useLayoutTuning } from './useTuning'

type Props = {
  /** 'results': on the end screen (the middle button shows the board); 'board': on the garden (it shows the results). */
  view: 'results' | 'board'
  onMenu: () => void
  onNewGame: () => void
}

export function EndBar({ view, onMenu, onNewGame }: Props) {
  const { bottomRoom } = useLayoutTuning()
  const w = text.game.gameOver
  return (
    <div className="game-end-dock">
      <div className="game-end-buttons">
        <Button variant="ghost" icon aria-label={w.menu} title={w.menu} onClick={onMenu}>☰</Button>
        {view === 'results'
          ? <Button variant="secondary" onClick={() => screens.pop()}>{w.seeBoard}</Button>
          : <Button variant="secondary" onClick={() => screens.push('gameOver')}>{text.game.buttons.results}</Button>}
        <Button onClick={onNewGame}>{w.newGame}</Button>
      </div>
      {/* Room under the buttons, clear of the phone's home/back gesture edge (layout.json bottomRoom) */}
      <svg className="game-end-foot" width={0} height={bottomRoom} aria-hidden="true" />
    </div>
  )
}
