// MENUS — the home page and the screens it opens, all built from the UI kit.
// Words: content/text/en.json · settings rows: content/ui/settings.json · look: content/ui/style.json
import { Credits, HowToPlay, MainMenu, Pause, Settings, screens } from './kit'
import { GameOverScreen } from '../game/GameOver'
import { leaveToMenu, newGameFromEnd, openNewGame, playAgain } from './newGame'
import text from '../../content/text/en.json'
import settings from '../../content/ui/settings.json'
import credits from '../../content/credits.json'
import version from '../../version.json'

// The move → cast prototype is its own page (sketches/move-cast/), so the menu button goes there.
const prototypeUrl = `${import.meta.env.BASE_URL}sketches/move-cast/`

// HOME — title, tagline, and the menu buttons in our order (Play is the main button).
export function MainMenuScreen() {
  const w = text.mainMenu
  return (
    <MainMenu
      title={w.title}
      subtitle={w.subtitle}
      items={[
        { label: w.play, onClick: openNewGame, primary: true },
        { label: w.prototype, onClick: () => window.location.assign(prototypeUrl) },
        { label: w.settings, onClick: () => screens.push('settings') },
      ]}
    />
  )
}

// SETTINGS — rows come from content/ui/settings.json ("on": false hides a row).
export function SettingsScreen() {
  const onAction = (id: string) => {
    if (id === 'credits') screens.push('credits')
  }
  return <Settings schema={settings} info={{ version: `v${version.version}` }} onAction={onAction} />
}

// CREDITS — people from en.json, then every asset listed in content/credits.json.
export function CreditsScreen() {
  return <Credits people={text.credits.people} assets={credits} />
}

// PAUSE — the Menu button in the game: back to the garden, the Rules, Settings, or leave (asks first).
export function PauseScreen() {
  const w = text.game.pause
  return <Pause words={w} onHowToPlay={() => screens.push('rules')} onSettings={() => screens.push('settings')} onQuit={leaveToMenu} />
}

// RULES — a short how-to-play in three pages (words: en.json → game.rules), opened from Pause.
export function RulesScreen() {
  const { pages, ...words } = text.game.rules
  return <HowToPlay pages={pages} words={words} />
}

// GAME OVER — the end table over the tangled garden (src/game/GameOver.tsx).
export function GameOverDialog() {
  return <GameOverScreen onPlayAgain={playAgain} onNewGame={newGameFromEnd} onMenu={leaveToMenu} />
}
