// THE GAME UI KIT — copy this whole folder into a game's src/ui/kit/.
// Then: applyStyle(styleJson) once at start-up, and build screens from these parts.
// Needs React 18 or newer (tested on 18.3 and 19).
import './fonts/fonts.css'
import './kit.css'

export * from './layout'
export * from './controls'
export { screens } from './screens'
export { ScreenStack, useScreens } from './ScreenStack'
export { applyStyle, resolveStyle, type StyleFile } from './style/applyStyle'
export { presets } from './styles'
export * from './blocks'
