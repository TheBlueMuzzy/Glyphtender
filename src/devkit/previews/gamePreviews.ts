// Finds the game's preview list: src/devkit-game/previews.tsx (or .ts), `export const previews: DevKitPreview[]`.
// Found by file name (import.meta.glob), like the Color tab finds the UI kit — so a game without the file still
// builds, and its Screens tab just says how to add one. Only the Screens tab and the preview frame load this,
// and both are dev-only.
import type { DevKitPreview } from './previewTypes'

const found = import.meta.glob<{ previews?: DevKitPreview[] }>('../../devkit-game/previews.{ts,tsx}')

/** The game's previews ([] if it has no previews file yet). */
export async function loadGamePreviews(): Promise<DevKitPreview[]> {
  const load = Object.values(found)[0]
  if (!load) return []
  return (await load()).previews ?? []
}

/** Where the list lives, for the "how to add previews" note. */
export const PREVIEWS_FILE = 'src/devkit-game/previews.tsx'
