// Home page = the UI kit's main menu; Play opens the new-game screen, and Start swaps the menu for the game.
// Settings, Credits, Pause, the new-game screen and the end table open on top through the kit's screen stack
// (Back, Esc and phone Back close the top one).
import { useGameStore } from './store/gameStore'
import { GameScreen } from './game/GameScreen'
import { ScreenStack, ToastStack, kitScreens } from './ui/kit'
import { CreditsScreen, GameOverDialog, MainMenuScreen, PauseScreen, SettingsScreen } from './ui/menus'
import { playAgain } from './ui/newGame'
import { NewGameScreen } from './ui/NewGameScreen'

const menuScreens = { ...kitScreens, settings: SettingsScreen, credits: CreditsScreen, pause: PauseScreen, gameOver: GameOverDialog, newGame: NewGameScreen }

export default function App() {
  const inGame = useGameStore((s) => s.game !== null)
  return (
    <>
      <ScreenStack screens={menuScreens}>
        {inGame ? <GameScreen onPlayAgain={playAgain} /> : <MainMenuScreen />}
      </ScreenStack>
      <ToastStack />
    </>
  )
}
