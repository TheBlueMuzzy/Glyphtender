// Home page = the UI kit's main menu; Play opens the new-game screen, and Start swaps the menu for the game.
// Settings, Credits, Pause, the new-game screen and the end table open on top through the kit's screen stack
// (Back, Esc and phone Back close the top one).
// Online: Play online opens the join screen; in a room the lobby takes the menu's place, and OnlineSession
// keeps the connection open (lobby → game → end table) for as long as this device is in the room.
import { useGameStore } from './store/gameStore'
import { GameScreen } from './game/GameScreen'
import { ScreenStack, ToastStack } from './ui/kit'
import { LobbyScreen, MainMenuScreen } from './ui/menus'
import { menuScreens } from './ui/menuScreens'
import { OnlineSession } from './ui/online/OnlineSession'
import { useOnline } from './ui/online/session'
import { newGameFromEnd } from './ui/newGame'

export default function App() {
  const inGame = useGameStore((s) => s.game !== null)
  const online = useOnline((s) => s.code !== null)
  const inLobby = useOnline((s) => s.room?.room?.phase === 'lobby')
  return (
    <>
      <ScreenStack screens={menuScreens}>
        {inGame ? <GameScreen onNewGame={newGameFromEnd} /> : online && inLobby ? <LobbyScreen /> : <MainMenuScreen />}
      </ScreenStack>
      {online && <OnlineSession />}
      <ToastStack />
    </>
  )
}
