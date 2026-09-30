// BUG CAPTURE TOOL — catch a bug with everything Claude needs to fix it.
//   ● Record: keeps the last ~60 s of the game's events + its state every ~5 s (captureLog.ts). Stays on across
//     reloads once switched on (remembered in this browser), so it's already running when something goes wrong.
//   📍 Mark: "it happened here" — keeps that moment's state.
//   What went wrong: a line in your own words.
//   Send to /bug (dev only): saves .planning/bugs/capture-<date>.json in the game — tell Claude "/bug" and the file.
//   Copy for Claude: the same capture as text to paste into the chat (the only way out of a live build).
// Needs the game's adapter (registerDevKitGame in src/devkit-game/tabs.ts) — see devkitGame.ts.
import { useEffect, useRef, useState } from 'react'
import { describeMoment, useDevKitGame, type DevKitGame } from '../devkitGame'
import { NotPluggedIn } from '../NotPluggedIn'
import { CAN_SAVE, copyText, saveContentFile } from '../saveContent'
import { KEEP_MS, STATE_EVERY_MS, clearLog, logMark, newCaptureLog, recentLog, type CaptureLog } from './captureLog'
import { buildBugCapture, captureFilePath, captureForClaude, count, readDevice, type BugCapture } from './captureReport'
import { copyOfState, startRecording } from './captureRecorder'
import './capture.css'

const RECORDING_KEY = 'devkit.capture.recording' // remembers ● Record across reloads

function rememberedRecording(): boolean {
  try {
    return localStorage.getItem(RECORDING_KEY) === 'on'
  } catch {
    return false
  }
}
function rememberRecording(on: boolean) {
  try {
    localStorage.setItem(RECORDING_KEY, on ? 'on' : 'off')
  } catch { /* blocked storage: it just won't be remembered */ }
}

// The log as it stands now, for the screen
function showLog(log: CaptureLog) {
  const now = Date.now()
  return { now, recent: recentLog(log, now) }
}

type Status = { kind: 'ok' | 'error' | 'info'; text: string }

export function CaptureTab() {
  const game = useDevKitGame()
  if (!game) return <NotPluggedIn />
  return <Capture key={game.name} game={game} />
}

function Capture({ game }: { game: DevKitGame }) {
  const log = useRef(newCaptureLog()) // the recorder writes here directly — no re-render per event
  const [recording, setRecording] = useState(rememberedRecording)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [sent, setSent] = useState<{ capture: BugCapture; savedTo: string | null } | null>(null) // the last Send
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  // What the tab shows (counts, marks): a copy of the log, refreshed once a second while recording and after each
  // button — the log itself changes on every event without re-rendering anything.
  const [shown, setShown] = useState(() => ({ now: Date.now(), recent: newCaptureLog() }))
  const refresh = () => setShown(showLog(log.current))

  useEffect(() => {
    if (!recording) return
    const stop = startRecording(game, log.current)
    const counter = setInterval(() => setShown(showLog(log.current)), 1000)
    return () => {
      stop()
      clearInterval(counter)
    }
  }, [recording, game])

  const { now, recent } = shown

  function toggleRecording() {
    rememberRecording(!recording)
    setRecording(!recording)
    setStatus(null)
  }

  function mark() {
    const state = copyOfState(game)
    logMark(log.current, state, describeMoment(game, state), Date.now())
    setSent(null)
    refresh()
  }

  function clear() {
    clearLog(log.current)
    refresh()
    setNote('')
    setSent(null)
    setStatus({ kind: 'info', text: 'Cleared.' })
  }

  function makeCapture(): BugCapture {
    const at = Date.now()
    const stateNow = copyOfState(game)
    return buildBugCapture({
      game,
      whatWentWrong: note,
      log: recentLog(log.current, at),
      stateNow,
      summaryNow: describeMoment(game, stateNow),
      device: readDevice(),
      now: at,
    })
  }

  // Dev: save the capture where /bug looks for it (the Save endpoint allows .planning/bugs/ for this)
  async function send() {
    const capture = makeCapture()
    const path = captureFilePath(new Date(capture.capturedAt))
    setStatus({ kind: 'info', text: 'Saving…' })
    try {
      await saveContentFile(path, capture)
      setSent({ capture, savedTo: path })
      clearLog(log.current)
      refresh()
      setNote('')
      setStatus({ kind: 'ok', text: `Saved ${path} — tell Claude "/bug" and paste that path, or Copy for Claude.` })
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't save: ${(e as Error).message} — Copy for Claude still works.` })
    }
  }

  async function copy() {
    const text = sent ? captureForClaude(sent.capture, sent.savedTo) : captureForClaude(makeCapture(), null)
    if (await copyText(text)) {
      setCopyFallback(null)
      setStatus({ kind: 'ok', text: 'Copied — paste it into your chat with Claude.' })
    } else {
      setCopyFallback(text)
      setStatus({ kind: 'error', text: 'The browser blocked copying — select the text below and copy it.' })
    }
  }

  const seconds = Math.round(KEEP_MS / 1000)
  return (
    <div className="bc">
      <div className="bc-controls">
        <button
          className={recording ? 'devkit-btn bc-record is-on' : 'devkit-btn bc-record'}
          onClick={toggleRecording}
          aria-pressed={recording}
        >
          {recording ? '■ Stop recording' : '● Record'}
        </button>
        <button className="devkit-btn" onClick={mark} title="It happened here — keeps this moment's state">
          📍 Mark
        </button>
      </div>
      <p className="bc-counts" role="status">
        {recording
          ? `Recording — last ${seconds} s: ${count(recent.events.length, 'event')} · ${count(recent.states.length, 'state')} (one every ${STATE_EVERY_MS / 1000} s)`
          : `Not recording. ● Record keeps the last ${seconds} s of play; it stays on after a reload.`}
      </p>

      {recent.marks.length > 0 && (
        <ul className="bc-marks">
          {recent.marks.map((m) => (
            <li key={m.at}>
              📍 {Math.round((now - m.at) / 1000)} s ago{m.summary && ` — ${m.summary}`}
            </li>
          ))}
        </ul>
      )}

      <label className="bc-label">
        What went wrong?
        <textarea
          className="bc-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setSent(null)
          }}
          placeholder="e.g. I cast on the glowing hex and nothing happened"
          rows={3}
        />
      </label>

      <footer className="devkit-footer">
        {/* Live build: no dev server to save through, so Copy for Claude is the main button (see CAN_SAVE) */}
        {CAN_SAVE && (
          <button className="devkit-btn devkit-btn-main" onClick={send}>
            Send to /bug
          </button>
        )}
        <button className={CAN_SAVE ? 'devkit-btn' : 'devkit-btn devkit-btn-main'} onClick={copy}>
          Copy for Claude
        </button>
        <button className="devkit-btn" onClick={clear}>
          Clear
        </button>
        {status && <p className={`devkit-status is-${status.kind}`}>{status.text}</p>}
        {copyFallback && <textarea className="bc-copy" readOnly value={copyFallback} onFocus={(e) => e.target.select()} />}
      </footer>
    </div>
  )
}
