// MENUS — the home page and the screens it opens, all built from the UI kit.
// Words: content/text/en.json · settings rows: content/ui/settings.json · look: content/ui/style.json
import { Credits, MainMenu, Settings, screens } from './kit'
import text from '../../content/text/en.json'
import settings from '../../content/ui/settings.json'
import credits from '../../content/credits.json'
import version from '../../version.json'

// The move → cast prototype is its own page (sketches/move-cast/), so the menu button goes there.
const prototypeUrl = `${import.meta.env.BASE_URL}sketches/move-cast/`

// HOME — title, tagline, and the menu buttons in our order (the first one is the main button).
export function MainMenuScreen() {
  const w = text.mainMenu
  return (
    <MainMenu
      title={w.title}
      subtitle={w.subtitle}
      items={[
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
