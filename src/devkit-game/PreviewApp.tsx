// The game WITHOUT its live connection — for the Dev Kit's online screen previews (previews.tsx).
// Same tree as App.tsx, minus OnlineSession: that would try to reach the server and, finding no room, end the
// sample online game. The previews put a fake room in the session store instead.
import text from '../../content/text/en.json'
import { GameScreen } from '../game/GameScreen'
import { useGameStore } from '../store/gameStore'
import { Reconnecting, ScreenStack, ToastStack } from '../ui/kit'
import { LobbyScreen, MainMenuScreen } from '../ui/menus'
import { menuScreens } from '../ui/menuScreens'
import { newGameFromEnd } from '../ui/newGame'
import { useOnline } from '../ui/online/session'

/** reconnecting: show the kit's Reconnecting box on top, as OnlineSession does while the connection comes back. */
export function PreviewApp({ reconnecting = false }: { reconnecting?: boolean }) {
  const inGame = useGameStore((s) => s.game !== null)
  const inLobby = useOnline((s) => s.room?.room?.phase === 'lobby')
  const w = text.online.reconnect
  return (
    <>
      <ScreenStack screens={menuScreens}>
        {inGame ? <GameScreen onNewGame={newGameFromEnd} /> : inLobby ? <LobbyScreen /> : <MainMenuScreen />}
      </ScreenStack>
      {reconnecting && <Reconnecting words={{ title: w.title, quit: w.quit }} message={w.message} onQuit={() => {}} />}
      <ToastStack />
    </>
  )
}
