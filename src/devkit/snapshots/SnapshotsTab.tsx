// SNAPSHOTS TOOL — save "this exact moment" of the game, and put the game back to it later.
//   Save moment: asks the game for its state (getState) and keeps it in this browser under a name.
//   Restore: hands that state back to the game (setState) — off in online games (canRestore false).
//   Save to file (dev only): writes content/snapshots/<name>.json, so Claude and tests can load the same moment;
//   files already there are listed underneath. Copy for Claude: the snapshot as JSON, to paste into the chat.
// Needs the game's adapter (registerDevKitGame in src/devkit-game/tabs.ts) — see devkitGame.ts.
import { useState, type ReactNode } from 'react'
import { describeMoment, useDevKitGame, type DevKitGame } from '../devkitGame'
import { NotPluggedIn } from '../NotPluggedIn'
import { CAN_SAVE, copyText, saveContentFile } from '../saveContent'
import { snapshotFiles } from './snapshotFiles'
import {
  addSnapshot, cleanName, deleteSnapshot, loadSnapshots, shortTime, snapshotFilePath, snapshotForClaude, type Snapshot,
} from './snapshotStore'
import './snapshots.css'

type Status = { kind: 'ok' | 'error' | 'info'; text: string }

export function SnapshotsTab({ files = snapshotFiles }: { files?: Snapshot[] }) {
  const game = useDevKitGame()
  if (!game) return <NotPluggedIn />
  // key: a different game (or a re-registered one) starts with its own list
  return <Snapshots key={game.name} game={game} files={files} />
}

function Snapshots({ game, files }: { game: DevKitGame; files: Snapshot[] }) {
  const [saved, setSaved] = useState(() => loadSnapshots(game.name)) // this browser's, newest first
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null) // shown if the clipboard is blocked
  const restoreAllowed = game.canRestore()

  function saveMoment() {
    try {
      const state = game.getState()
      const snapshot: Snapshot = {
        name: cleanName(name, saved.length + 1),
        savedAt: new Date().toISOString(),
        game: game.name,
        version: game.version,
        summary: describeMoment(game, state),
        state: JSON.parse(JSON.stringify(state)), // a deep copy, so later play can't change it
      }
      const { list, error } = addSnapshot(game.name, snapshot)
      setSaved(list)
      setName('')
      setStatus(error ? { kind: 'error', text: `Couldn't keep it: ${error}` } : { kind: 'ok', text: `Saved "${snapshot.name}".` })
    } catch (e) {
      setStatus({ kind: 'error', text: `The game couldn't give its state: ${(e as Error).message}` })
    }
  }

  function restore(snapshot: Snapshot) {
    if (!game.canRestore()) return setStatus({ kind: 'error', text: 'Restoring is off in an online game.' })
    try {
      game.setState(JSON.parse(JSON.stringify(snapshot.state))) // a copy, so the saved one stays as it was
      setStatus({ kind: 'ok', text: `Restored "${snapshot.name}".` })
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't restore "${snapshot.name}": ${(e as Error).message}` })
    }
  }

  function remove(snapshot: Snapshot) {
    setSaved(deleteSnapshot(game.name, snapshot.name))
    setStatus({ kind: 'info', text: `Deleted "${snapshot.name}" from this browser.` })
  }

  async function saveToFile(snapshot: Snapshot) {
    const path = snapshotFilePath(snapshot.name)
    setStatus({ kind: 'info', text: 'Saving…' })
    try {
      await saveContentFile(path, { _help: 'A Dev Kit snapshot: press ` → Snapshots → Restore to jump here.', ...snapshot })
      setStatus({ kind: 'ok', text: `Saved ${path} — Claude and tests can load it now.` })
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't save: ${(e as Error).message}` })
    }
  }

  async function copy(snapshot: Snapshot) {
    const text = snapshotForClaude(snapshot)
    if (await copyText(text)) {
      setCopyFallback(null)
      setStatus({ kind: 'ok', text: 'Copied — paste it into your chat with Claude.' })
    } else {
      setCopyFallback(text)
      setStatus({ kind: 'error', text: 'The browser blocked copying — select the text below and copy it.' })
    }
  }

  return (
    <div className="sn">
      <form
        className="sn-new"
        onSubmit={(e) => {
          e.preventDefault()
          saveMoment()
        }}
      >
        <input
          className="sn-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this moment (e.g. one move from tangled)"
          aria-label="Snapshot name"
        />
        <button className="devkit-btn devkit-btn-main" type="submit">Save moment</button>
      </form>
      {!restoreAllowed && <p className="sn-note">Restoring is off: this is an online game (it would change play for everyone).</p>}
      {status && <p className={`devkit-status sn-status is-${status.kind}`} role="status">{status.text}</p>}
      {copyFallback && <textarea className="sn-copy" readOnly value={copyFallback} onFocus={(e) => e.target.select()} />}

      <h3 className="sn-heading">Saved in this browser</h3>
      {saved.length === 0 && <p className="sn-empty">None yet — play to an interesting moment and press Save moment.</p>}
      <ul className="sn-list">
        {saved.map((s) => (
          <SnapshotRow key={s.name} snapshot={s} canRestore={restoreAllowed} onRestore={() => restore(s)} onCopy={() => copy(s)}>
            {CAN_SAVE && <button className="devkit-btn" onClick={() => saveToFile(s)} title={`Write ${snapshotFilePath(s.name)}`}>Save to file</button>}
            <button className="devkit-btn sn-delete" onClick={() => remove(s)} aria-label={`Delete ${s.name}`} title="Delete">✕</button>
          </SnapshotRow>
        ))}
      </ul>

      {files.length > 0 && (
        <>
          <h3 className="sn-heading">In the game's files <small>content/snapshots/</small></h3>
          <ul className="sn-list">
            {files.map((s) => (
              <SnapshotRow key={s.name} snapshot={s} canRestore={restoreAllowed} onRestore={() => restore(s)} onCopy={() => copy(s)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

type RowProps = {
  snapshot: Snapshot
  canRestore: boolean
  onRestore: () => void
  onCopy: () => void
  children?: ReactNode // extra buttons
}

// One snapshot: name + time + summary, then its buttons
function SnapshotRow({ snapshot, canRestore, onRestore, onCopy, children }: RowProps) {
  return (
    <li className="sn-row">
      <div className="sn-info">
        <strong className="sn-row-name">{snapshot.name}</strong>
        <small className="sn-time">{shortTime(snapshot.savedAt)} · v{snapshot.version}</small>
        {snapshot.summary && <small className="sn-summary">{snapshot.summary}</small>}
      </div>
      <div className="sn-buttons">
        <button className="devkit-btn devkit-btn-main" disabled={!canRestore} onClick={onRestore}>Restore</button>
        <button className="devkit-btn" onClick={onCopy}>Copy for Claude</button>
        {children}
      </div>
    </li>
  )
}
