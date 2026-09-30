// Home page = the UI kit's main menu; Play swaps it for the game. Settings, Credits, Pause and the
// game-over results open on top through the kit's screen stack (Back, Esc and phone Back close the top one).
import { useGameStore } from './store/gameStore'
import { GameScreen } from './game/GameScreen'
import { ScreenStack, ToastStack, kitScreens } from './ui/kit'
import { CreditsScreen, GameOverDialog, MainMenuScreen, PauseScreen, SettingsScreen } from './ui/menus'
import { playAgain } from './ui/newGame'

const menuScreens = { ...kitScreens, settings: SettingsScreen, credits: CreditsScreen, pause: PauseScreen, gameOver: GameOverDialog }

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
