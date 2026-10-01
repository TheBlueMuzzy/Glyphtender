// Every screen the kit's screen stack can open (screens.push('pause') …) — App.tsx hands it to the ScreenStack.
// Its own file so the Dev Kit's screen previews (src/devkit-game/previews.tsx) open the same screens.
import { kitScreens } from './kit'
import { CreditsScreen, GameOverDialog, OnlineStartScreen, PauseScreen, RulesScreen, SettingsScreen } from './menus'
import { NewGameScreen } from './NewGameScreen'

export const menuScreens = { ...kitScreens, settings: SettingsScreen, credits: CreditsScreen, pause: PauseScreen, gameOver: GameOverDialog, newGame: NewGameScreen, rules: RulesScreen, online: OnlineStartScreen }
