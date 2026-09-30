// SNAPSHOTS — "this exact moment" of the game, saved so it can be restored later.
// Kept in this browser (localStorage, one list per game), and in dev also as files in content/snapshots/
// so Claude and tests can load the same moment. Plain functions only — the tab (SnapshotsTab.tsx) uses them.

export interface Snapshot {
  name: string
  /** When it was saved (ISO date + time). */
  savedAt: string
  game: string
  version: string
  /** One line about the moment, from the game's describe() — may be empty. */
  summary: string
  /** Whatever the game's getState() gave — plain JSON. */
  state: unknown
}

const MAX_NAME_LENGTH = 60

const storageKey = (game: string) => `devkit.snapshots.${game}`

/** A tidy name: trimmed, one line, not too long; "Snapshot 3" if left empty. */
export function cleanName(name: string, fallbackNumber: number): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)
  return clean || `Snapshot ${fallbackNumber}`
}

/** Is this something a Snapshot file / storage could hold? (Files and storage can contain anything.) */
export function isSnapshot(value: unknown): value is Snapshot {
  const s = value as Snapshot | null
  return typeof s === 'object' && s !== null && typeof s.name === 'string' && typeof s.savedAt === 'string' && 'state' in s
}

/**
 * The snapshots saved in this browser for this game, newest first.
 * Never throws: blocked storage (private window) or a damaged entry → an empty list.
 */
export function loadSnapshots(game: string): Snapshot[] {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(game)) ?? '[]')
    return Array.isArray(list) ? list.filter(isSnapshot) : []
  } catch {
    return []
  }
}

/** Write the list back. Returns a plain reason if the browser refused (storage full or blocked), else null. */
function writeSnapshots(game: string, list: Snapshot[]): string | null {
  try {
    localStorage.setItem(storageKey(game), JSON.stringify(list))
    return null
  } catch {
    return 'the browser would not store it (storage full or blocked) — try Copy for Claude instead'
  }
}

/** Add a snapshot (one with the same name is replaced). Returns the new list, or the reason it couldn't. */
export function addSnapshot(game: string, snapshot: Snapshot): { list: Snapshot[]; error: string | null } {
  const list = [snapshot, ...loadSnapshots(game).filter((s) => s.name !== snapshot.name)]
  const error = writeSnapshots(game, list)
  return { list: error ? loadSnapshots(game) : list, error }
}

/** Remove a snapshot by name. Returns the new list. */
export function deleteSnapshot(game: string, name: string): Snapshot[] {
  const list = loadSnapshots(game).filter((s) => s.name !== name)
  writeSnapshots(game, list)
  return list
}

/** "One move from tangled!" → "content/snapshots/one-move-from-tangled.json" */
export function snapshotFilePath(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `content/snapshots/${slug || 'snapshot'}.json`
}

/** "30 Sep, 23:15" — short, for the list */
export function shortTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}

/** Copy for Claude: what it is, where it could live, and the JSON itself. */
export function snapshotForClaude(snapshot: Snapshot): string {
  return [
    `Dev Kit snapshot from ${snapshot.game} ${snapshot.version} — "${snapshot.name}"${snapshot.summary ? ` (${snapshot.summary})` : ''}.`,
    `To keep it, save this JSON as ${snapshotFilePath(snapshot.name)} — the Snapshots tab lists files there.`,
    '',
    JSON.stringify(snapshot, null, 2),
  ].join('\n')
}
