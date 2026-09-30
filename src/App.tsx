// Home page = the UI kit's main menu. Settings and Credits open on top through the kit's screen stack
// (Back, Esc and phone Back close the top one).
import { ScreenStack, ToastStack, kitScreens } from './ui/kit'
import { CreditsScreen, MainMenuScreen, SettingsScreen } from './ui/menus'

const menuScreens = { ...kitScreens, settings: SettingsScreen, credits: CreditsScreen }

export default function App() {
  return (
    <>
      <ScreenStack screens={menuScreens}>
        <MainMenuScreen />
      </ScreenStack>
      <ToastStack />
    </>
  )
}
