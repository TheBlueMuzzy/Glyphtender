// TUNING TOOL — every number in the game's content/tuning/*.json files, as a slider + a number box.
//   Groups inside a file (nested keys) become headings; true/false values get a checkbox; text is shown, not edited.
//   Slider ranges: the file's optional "_ranges" { "key.path": [min, max, step] }, else a guess (tuningLogic.ts).
// Live: each change is sent to the game as it happens (liveTuning.ts) — the game shows it if it reads its tuning
// through liveTuning / useLiveTuning. ↺ on a row = back to the saved value. A dot = changed, not saved yet.
import { useState } from 'react'
import { CAN_SAVE, copyText, saveContentFile } from '../saveContent'
import { copyForClaudeText } from '../color/colorLogic'
import { sendTuning } from './liveTuning'
import { tuningFiles, type TuningFile } from './tuningFiles'
import { groupOf, listFields, listTuningChanges, nameOf, sliderRange, tuningChanged, valueAt, withValue, type Field, type TuningData } from './tuningLogic'
import './tuning.css'

type Files = Record<string, TuningData> // file name → its data

const byName = (files: TuningFile[]): Files => Object.fromEntries(files.map((f) => [f.name, f.data]))
const pathOf = (name: string) => `content/tuning/${name}.json`

export function TuningTab({ files = tuningFiles }: { files?: TuningFile[] }) {
  const [loaded] = useState(() => byName(files)) // as the page loaded — ranges and Copy for Claude start from this
  const [values, setValues] = useState(loaded) // what the game uses right now
  const [saved, setSaved] = useState(loaded) // what's in the files
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null) // shown if the clipboard is blocked

  const names = Object.keys(loaded)
  const unsaved = names.filter((name) => tuningChanged(values[name], saved[name]))

  function change(name: string, path: string, value: unknown) {
    const data = withValue(values[name], path, value)
    setValues((v) => ({ ...v, [name]: data }))
    sendTuning(name, data) // live in the game
  }

  function undo() {
    for (const name of unsaved) sendTuning(name, saved[name])
    setValues(saved)
  }

  // Save: each changed file is written whole — its _help and _ranges come along untouched
  async function save() {
    setStatus({ kind: 'info', text: 'Saving…' })
    try {
      for (const name of unsaved) await saveContentFile(pathOf(name), values[name])
      setSaved(values)
      setStatus({ kind: 'ok', text: `Saved ${unsaved.map(pathOf).join(', ')} — refresh and it stays.` })
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't save: ${(e as Error).message}` })
    }
  }

  async function copyForClaude() {
    const changes = names.flatMap((name) => listTuningChanges(name, loaded[name], values[name]))
    const text = copyForClaudeText(document.title, changes, unsaved.length === 0, !CAN_SAVE, 'Tuning', 'content/tuning/')
    if (await copyText(text)) {
      setCopyFallback(null)
      setStatus({ kind: 'ok', text: 'Copied — paste it into your chat with Claude.' })
    } else {
      setCopyFallback(text)
      setStatus({ kind: 'error', text: 'The browser blocked copying — select the text below and copy it.' })
    }
  }

  return (
    <div className="tt">
      <p className="tt-legend">
        <span className="tt-dot" /> = changed, not saved yet · ↺ = back to the saved value · changes show in the game live
      </p>
      {names.map((name) => (
        <FileSection
          key={name}
          name={name}
          data={values[name]}
          loaded={loaded[name]}
          saved={saved[name]}
          onChange={(path, value) => change(name, path, value)}
        />
      ))}

      <footer className="devkit-footer">
        {/* Live build: no dev server to save through, so Copy for Claude is the main button (see CAN_SAVE) */}
        {CAN_SAVE && (
          <button className="devkit-btn devkit-btn-main" disabled={unsaved.length === 0} onClick={save}>
            Save
          </button>
        )}
        <button className={CAN_SAVE ? 'devkit-btn' : 'devkit-btn devkit-btn-main'} onClick={copyForClaude}>
          Copy for Claude
        </button>
        <button className="devkit-btn" disabled={unsaved.length === 0} onClick={undo} title="Put every value back to what's saved">
          {CAN_SAVE ? 'Undo unsaved' : 'Undo changes'}
        </button>
        {status && <p className={`devkit-status is-${status.kind}`} role="status">{status.text}</p>}
        {copyFallback && <textarea className="tt-copy" readOnly value={copyFallback} onFocus={(e) => e.target.select()} />}
      </footer>
    </div>
  )
}

type SectionProps = {
  name: string
  data: TuningData
  loaded: TuningData
  saved: TuningData
  onChange: (path: string, value: unknown) => void
}

// One file: its name, its _help note, then its values under their group headings.
// "_help" is either one note for the whole file, or one per value: { "dragHeight": "how high a die lifts" }
function FileSection({ name, data, loaded, saved, onChange }: SectionProps) {
  const fields = listFields(data)
  const help = typeof data._help === 'string' ? data._help : null
  const helpPerValue = data._help && typeof data._help === 'object' ? (data._help as Record<string, unknown>) : {}
  return (
    <section className="tt-file">
      <h3 className="tt-file-name">{name}.json <small>{pathOf(name)}</small></h3>
      {help && <p className="tt-help">{help}</p>}
      {fields.map((field, i) => {
        const group = groupOf(field.path)
        const newGroup = group && group !== groupOf(fields[i - 1]?.path ?? '')
        return (
          <div key={field.path}>
            {newGroup && <h4 className="tt-group">{group}</h4>}
            <FieldRow
              field={field}
              savedValue={valueAt(saved, field.path)}
              loadedValue={valueAt(loaded, field.path)}
              ranges={data._ranges}
              help={typeof helpPerValue[field.path] === 'string' ? (helpPerValue[field.path] as string) : undefined}
              onChange={(value) => onChange(field.path, value)}
            />
          </div>
        )
      })}
    </section>
  )
}

type RowProps = {
  field: Field
  savedValue: unknown
  loadedValue: unknown
  ranges: unknown
  help?: string // this value's own line from _help, if the file has one per value
  onChange: (value: unknown) => void
}

// One value: [● name] then [slider] [number] [↺] — or a checkbox, or plain text
function FieldRow({ field, savedValue, loadedValue, ranges, help, onChange }: RowProps) {
  const { path, kind, value } = field
  const label = nameOf(path)
  const changed = value !== savedValue
  const name = (
    <span className="tt-name">
      {changed && <span className="tt-dot" title="Changed, not saved yet" />}
      {label}
    </span>
  )
  const helpLine = help && <p className="tt-row-help">{help}</p>

  if (kind === 'text') {
    return (
      <div className="tt-row tt-row-text">
        {name}
        <span className="tt-text" title="Text — edit it in the file">
          {/^#[0-9a-f]{3,8}$/i.test(String(value)) && <span className="tt-swatch" style={{ background: String(value) }} />}
          {String(value)}
        </span>
        {helpLine}
      </div>
    )
  }

  const reset = (
    <button
      className="tt-reset"
      disabled={!changed}
      onClick={() => onChange(savedValue)}
      title={`Back to the saved value: ${String(savedValue)}`}
      aria-label={`Reset ${path} to the saved value (${String(savedValue)})`}
    >
      ↺
    </button>
  )

  if (kind === 'boolean') {
    return (
      <div className="tt-row tt-row-bool">
        <label className="tt-name">
          <input type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          {changed && <span className="tt-dot" title="Changed, not saved yet" />}
          {label}
        </label>
        {reset}
        {helpLine}
      </div>
    )
  }

  // A number. The range comes from the value as loaded, so it doesn't shift while you drag.
  const { min, max, step } = sliderRange(typeof loadedValue === 'number' ? loadedValue : (value as number), path, ranges)
  return (
    <div className="tt-row">
      {name}
      <input
        className="tt-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value as number}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${path} slider (${min} to ${max})`}
      />
      <input
        className="tt-number"
        type="number"
        step={step}
        value={value as number}
        onChange={(e) => {
          if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber)
        }}
        aria-label={path}
      />
      {reset}
      {helpLine}
    </div>
  )
}
