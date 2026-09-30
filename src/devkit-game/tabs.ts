// THE GAME'S OWN DEV KIT TOOLS — one tab each, shown after the kit's own tabs (Color, …).
// This file (and everything in src/devkit-game/) belongs to the game: installing or updating the
// Dev Kit never touches it. To add a tool:
//   1. make a component in src/devkit-game/, e.g. TableTab.tsx — it edits a content/ JSON file,
//      with Save (saveContentFile) and Copy for Claude (copyText) from '../devkit/saveContent'
//   2. list it below:  { id: 'table', label: 'Table', Panel: TableTab }
import type { ComponentType } from 'react'
import { registerDevKitGame } from '../devkit/devkitGame'
import { glyphtenderAdapter } from './glyphtenderAdapter'

// Plugs Glyphtender into the Dev Kit's Snapshots + Bug capture tabs (this file only loads with the Dev Kit)
registerDevKitGame(glyphtenderAdapter)

export const gameTabs: { id: string; label: string; Panel: ComponentType }[] = []
