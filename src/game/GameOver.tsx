// GAME OVER (basic — the staged Magic reveal is F13): kit Results dialog over the garden,
// "The garden is tangled", each player's Magic (winners starred; ties share the win), Play again + Menu.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { Button, Results } from '../ui/kit'
import { glyphlingArt, colourOf } from './art'
import { playerName } from './prompt'
import { useGardenTuning } from './useTuning'

const w = text.game.gameOver

export function GameOverScreen({ onPlayAgain, onMenu }: { onPlayAgain: () => void; onMenu: () => void }) {
  const game = useGameStore((s) => s.game)
  const colours = useGardenTuning()
  if (!game) return null
  const players = game.magic.map((magic, seat) => ({
    id: String(seat), name: playerName(seat), score: magic, avatar: glyphlingArt(seat), color: colours[colourOf(seat)],
  }))
  return (
    <Results dim title={w.title} message={w.message} players={players}
      words={{ points: w.points, winner: w.winner }}
      actions={<>
        <Button variant="secondary" onClick={onMenu}>{w.menu}</Button>
        <Button onClick={onPlayAgain}>{w.playAgain}</Button>
      </>} />
  )
}
