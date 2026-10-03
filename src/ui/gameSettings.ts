// THE GAME'S OWN SETTINGS — rows in content/ui/settings.json that change how the game looks, remembered by the
// kit's Settings (browser storage, one slot per game). Read once at start, then kept up to date whenever the
// Settings screen changes a value, so the game screen follows at once.
//   Gameplay → Tray position: "Standard" (tall: tray below the board · wide: on its right) or "Flipped"
//   (tall: above · wide: left).
//   Display → Full screen: src/ui/fullscreen.ts (its default depends on the device: on for phones, off for computers).
import { create } from 'zustand'
import settingsFile from '../../content/ui/settings.json'
import { fullscreenSetting, withFullscreenDefault } from './fullscreen'
import { loadSettings, type SettingsValues } from './kit'

/** content/ui/settings.json, with the Full screen default for this device — use this, not the file, everywhere. */
export const settings = withFullscreenDefault(settingsFile)

interface GameSettings {
  /** The seed tray (and its prompt + buttons) on the other side of the board. */
  trayFlipped: boolean
}

/** What the game needs from the saved settings values. */
export const fromSettings = (values: SettingsValues): GameSettings => ({ trayFlipped: values.trayPosition === 'Flipped' })

export const useGameSettings = create<GameSettings>()(() => fromSettings(loadSettings(settings)))

/** The Settings screen changed something: the game follows. */
export function settingsChanged(values: SettingsValues, changed?: string) {
  useGameSettings.setState(fromSettings(values))
  fullscreenSetting(values, changed)
}
