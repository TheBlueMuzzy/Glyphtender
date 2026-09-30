// Every content/snapshots/*.json file in the game, found with import.meta.glob — a Vite feature that finds
// nothing (without breaking the build) when the game has no snapshots folder yet.
import { isSnapshot, type Snapshot } from './snapshotStore'

const found = import.meta.glob<unknown>('../../../content/snapshots/*.json', { eager: true, import: 'default' })

/** Snapshot files, by name. Files that aren't snapshots are left out. */
export const snapshotFiles: Snapshot[] = Object.values(found)
  .filter(isSnapshot)
  .sort((a, b) => a.name.localeCompare(b.name))
