// THE END TABLE — opens when the Magic reveal finishes (or is skipped). Title: "Grand Glyphtender: Yellow!".
// One row per player, best first (ties share a place): place, portrait, name (★ for the winner(s)), Magic, and
// a line underneath with tangle Magic, best turn, longest word and words made (src/store/stats.ts).
// Buttons: Menu · New game (the new-game screen; online: the host takes everyone to the lobby) — no Play again:
// fewer, clearer options (GDD §4 feel notes). Esc closes it to look at the garden;
// the Results button brings it back. Kit parts only: Screen (dialog), Panel, ScrollArea, ListRow, Row, Avatar,
// Badge, Text, Button.
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import type { PlayerStats } from '../store/stats'
import { Avatar, Badge, Button, ListRow, Panel, Row, Screen, ScrollArea, Text, fill, ordinal, rankPlayers } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName, winnerTitle } from './prompt'
import { useGardenTuning } from './useTuning'

const w = text.game.gameOver

type Props = { onNewGame: () => void; onMenu: () => void }

export function GameOverScreen({ onNewGame, onMenu }: Props) {
  const game = useGameStore((s) => s.game)
  const stats = useGameStore((s) => s.stats)
  const colours = useGardenTuning()
  if (!game) return null
  const players = rankPlayers(game.magic.map((magic, seat) => ({ id: String(seat), seat, name: playerName(seat), score: magic })))
  return (
    <Screen dialog label={winnerTitle(game)}>
      <Panel depth={2} gap="m" className="kit-wide">
        <Text kind="title">{winnerTitle(game)}</Text>
        <ScrollArea label={w.title} max="l">
          {players.map((p) => (
            <ListRow key={p.id} detail={statsLine(game.tangleMagic[p.seat], stats[p.seat])} label={
              <Row gap="s" className="kit-nowrap">
                <Text kind="heading">{ordinal(p.place)}</Text>
                <Avatar name={p.name} src={glyphlingArt(p.seat)} color={colours[colourOf(p.seat)]} active={p.place === 1} />
                <Text kind="label">{p.name}</Text>
                {p.place === 1 && <Badge variant="primary"><span role="img" aria-label={w.winner}>★</span></Badge>}
              </Row>
            }>
              <Text kind="label">{fill(w.points, { n: p.score })}</Text>
            </ListRow>
          ))}
        </ScrollArea>
        {/* One row, sharing the width (game.css) */}
        <div className="game-end-buttons">
          <Button variant="ghost" onClick={onMenu}>{w.menu}</Button>
          <Button onClick={onNewGame}>{w.newGame}</Button>
        </div>
      </Panel>
    </Screen>
  )
}

/** "Tangles +6 · Best turn +12 · Longest GARDEN · 9 words" */
function statsLine(tangleMagic: number, mine: PlayerStats | undefined): string {
  const parts = [
    fill(w.tangleMagic, { n: tangleMagic }),
    fill(w.bestTurn, { n: mine?.bestTurn ?? 0 }),
    fill(w.longestWord, { word: mine?.longestWord || w.noWord }),
    fill(w.wordsMade, { n: mine?.wordsMade ?? 0 }),
  ]
  return parts.join(w.separator)
}
