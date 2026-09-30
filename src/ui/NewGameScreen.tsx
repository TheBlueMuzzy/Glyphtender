// NEW GAME — the table options before a pass-and-play game: players 2–4, garden size (defaults to the size
// boards.json names for that many players), 2-letter words on/off, hide seeds between turns on/off,
// word indicators on/off → Start.
// Built like the kit's Settings screen: Panel, a title row with Back, rows (ListRow + Stepper / Selector /
// Toggle) that scroll on short screens, and the Start button. Words: content/text/en.json → newGame.
import { useState } from 'react'
import text from '../../content/text/en.json'
import { Button, ListRow, Panel, Row, Screen, ScrollArea, Selector, Stepper, Text, Toggle, screens } from './kit'
import { boardNames, loadChoices, startNewGame, withPlayers, type NewGameChoices } from './newGame'

const w = text.newGame
const boardLabel = (name: string) => (w.boards as Record<string, string>)[name] ?? name

export function NewGameScreen() {
  const [choices, setChoices] = useState<NewGameChoices>(loadChoices)
  const change = (part: Partial<NewGameChoices>) => setChoices({ ...choices, ...part })
  const boards = boardNames()

  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-modal">
        <Row gap="s" justify="between">
          <Text kind="title">{w.title}</Text>
          <Button variant="secondary" onClick={() => screens.pop()}>{w.back}</Button>
        </Row>
        <ScrollArea label={w.title}>
          <ListRow label={w.players}>
            <Stepper label={w.players} value={choices.players} min={2} max={4} onChange={(players) => setChoices(withPlayers(choices, players))} />
          </ListRow>
          <ListRow label={w.board} detail={w.boardDetail}>
            <Selector label={w.board} options={boards.map(boardLabel)} value={boardLabel(choices.boardName)}
              onChange={(label) => change({ boardName: boards.find((b) => boardLabel(b) === label) ?? choices.boardName })} />
          </ListRow>
          <ListRow label={w.twoLetterWords} detail={w.twoLetterDetail}>
            <Toggle label={w.twoLetterWords} on={choices.twoLetterWords} onChange={(on) => change({ twoLetterWords: on })} />
          </ListRow>
          <ListRow label={w.hideSeeds} detail={w.hideSeedsDetail}>
            <Toggle label={w.hideSeeds} on={choices.hideSeeds} onChange={(on) => change({ hideSeeds: on })} />
          </ListRow>
          <ListRow label={w.wordIndicators} detail={w.wordIndicatorsDetail}>
            <Toggle label={w.wordIndicators} on={choices.wordIndicators} onChange={(on) => change({ wordIndicators: on })} />
          </ListRow>
        </ScrollArea>
        <Button onClick={() => startNewGame(choices)}>{w.start}</Button>
      </Panel>
    </Screen>
  )
}
