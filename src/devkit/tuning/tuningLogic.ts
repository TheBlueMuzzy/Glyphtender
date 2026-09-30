// The Tuning tool's thinking, kept apart from its looks so it can be tested (tuningLogic.test.ts, in the framework).
// Nothing here touches the page or the files.
//
// A tuning file is any JSON object in content/tuning/. Every value in it gets a "path" — its keys joined
// with dots, e.g. { "dice": { "bounce": 0.4 } } → "dice.bounce", and list items by number: "points.0".
// Keys starting with _ are notes for people or tools (_help, _ranges), never shown as values.
import type { Change } from '../color/colorLogic'

export type TuningData = Record<string, unknown>
export type Field = { path: string; kind: 'number' | 'boolean' | 'text'; value: unknown }
export type Range = { min: number; max: number; step: number }

const isNote = (key: string) => key.startsWith('_')

/** Every value in a file, in file order, as { path, kind, value }. Notes (_help, _ranges…) are skipped. */
export function listFields(data: unknown, prefix = ''): Field[] {
  const fields: Field[] = []
  const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v] as const) : Object.entries(data as TuningData)
  for (const [key, value] of entries) {
    if (!Array.isArray(data) && isNote(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object') fields.push(...listFields(value, path))
    else if (typeof value === 'number') fields.push({ path, kind: 'number', value })
    else if (typeof value === 'boolean') fields.push({ path, kind: 'boolean', value })
    else fields.push({ path, kind: 'text', value })
  }
  return fields
}

/** The value at a path, e.g. valueAt(data, "dice.bounce") */
export function valueAt(data: unknown, path: string): unknown {
  let here = data
  for (const key of path.split('.')) here = (here as TuningData | undefined)?.[key]
  return here
}

/** A copy of the file with one value changed. Everything else (including _help and _ranges) stays as it was. */
export function withValue<T>(data: T, path: string, value: unknown): T {
  const copy = structuredClone(data)
  const keys = path.split('.')
  const last = keys.pop()!
  let here = copy as TuningData
  for (const key of keys) here = here[key] as TuningData
  here[last] = value
  return copy
}

/** The heading a value sits under: its parent keys. "dice.bounce" → "dice", "maxSpeed" → "" (no heading). */
export const groupOf = (path: string) => path.split('.').slice(0, -1).join(' › ')

/** The name on a value's row: its own key. "dice.bounce" → "bounce" */
export const nameOf = (path: string) => path.split('.').pop()!

/**
 * The slider's range for a number.
 *   1. The file's own "_ranges": { "dice.bounce": [0, 1, 0.05] } = min, max, step — use this when the auto
 *      range is wrong (e.g. a multiplier of 1 that should go up to 5).
 *   2. Otherwise from the value as it was loaded: 0 → twice the value (negatives: twice the value → its opposite,
 *      e.g. −3 → −6…3, so the value never starts pinned at the slider's end).
 *      Whole numbers step by 1 and always get at least 0–10; decimals get about 100–1000 steps.
 */
export function sliderRange(value: number, path: string, ranges?: unknown): Range {
  const own = (ranges as Record<string, unknown> | undefined)?.[path]
  if (Array.isArray(own) && own.length >= 2 && own.every((n) => typeof n === 'number')) {
    const [min, max, step] = own as number[]
    return { min, max, step: step ?? autoStep(max - min) }
  }
  const size = Math.abs(value)
  if (Number.isInteger(value)) {
    const reach = Math.max(size * 2, 10)
    return { min: value < 0 ? -reach : 0, max: reach, step: 1 }
  }
  if (value < 0) return { min: -size * 2, max: size, step: autoStep(size * 3) } // room to grow, and to cross 0
  return { min: 0, max: size * 2, step: autoStep(size * 2) }
}

/** A step that splits a span into ~100–1000 pieces: 40 → 0.1, 2 → 0.01, 0.5 → 0.001 */
function autoStep(span: number): number {
  if (!(span > 0)) return 0.01
  return 10 ** (Math.floor(Math.log10(span)) - 2)
}

/** Every value that differs between two versions of a file, named "physics.json: maxSpeed" (for Copy for Claude). */
export function listTuningChanges(fileName: string, before: unknown, after: unknown): Change[] {
  const changes: Change[] = []
  for (const field of listFields(after)) {
    const was = valueAt(before, field.path)
    if (was !== field.value) changes.push({ name: `${fileName}.json: ${field.path}`, from: String(was), to: String(field.value) })
  }
  return changes
}

/** Does any value differ? (decides whether Save / Undo have anything to do) */
export const tuningChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

/** "../../../content/tuning/physics.json" → "physics" (the name games use with liveTuning) */
export const tuningName = (globPath: string) => globPath.split('/').pop()!.replace(/\.json$/, '')
