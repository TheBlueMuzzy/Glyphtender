// PROTOTYPE (code sketch) — move → cast → undo, no scoring, no turns. Answers F01:
// does "try freely, commit once" feel better than confirming every step, and can you read the board on a phone?
// Thrown away after; the learnings go into the GDD/TDD.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { boardFromColumns, hexKey, type Board, type Hex } from '../../src/engine/hex'
import { liveTuning, onTuning } from '../../src/devkit/tuning/liveTuning'
import boardsFile from '../../content/data/boards.json'
import bagFile from '../../content/data/bag.json'
import layoutFile from '../../content/tuning/layout.json'
import gardenFile from '../../content/tuning/garden.json'
import { legalCasts, legalMoves, makeBag, type Colour, type Glyphling, type Seed } from './rules'
import { GardenBoard, glyphlingArt, seedArt } from './GardenBoard'
import './sketch.css'

type BoardName = 'small' | 'large'
type Mode = 'oneCast' | 'confirmEach'
const BOARDS: Record<BoardName, Board> = {
  small: boardFromColumns(boardsFile.small.columns),
  large: boardFromColumns(boardsFile.large.columns),
}
// Where the 4 glyphlings start in the sketch (the real game drafts them)
const START: Record<BoardName, [Colour, string][]> = {
  small: [['yellow', 'C4-3'], ['blue', 'C8-3'], ['blue', 'C4-8'], ['yellow', 'C8-8']],
  large: [['yellow', 'C5-3'], ['blue', 'C9-3'], ['blue', 'C5-9'], ['yellow', 'C9-9']],
}

interface State {
  boardName: BoardName
  mode: Mode
  glyphlings: Glyphling[]
  seeds: Seed[]
  trays: Record<Colour, string[]>
  activeColour: Colour
  move: { id: string; to: Hex } | null // pending move (not cast yet)
  moveConfirmed: boolean // "confirm each step" mode only
  cast: { slot: number; hex: Hex } | null // pending cast
  selected: { glyph: string } | { slot: number } | null
  note: string | null
}

type Action =
  | { type: 'tapGlyph' | 'grabGlyph'; id: string }
  | { type: 'tapSlot' | 'grabSlot'; slot: number }
  | { type: 'tapHex'; key: string }
  | { type: 'undo' } | { type: 'confirmMove' }
  | { type: 'commit'; newLetter: string }
  | { type: 'newGame'; boardName: BoardName; mode: Mode; trays: Record<Colour, string[]> }

function newGame(boardName: BoardName, mode: Mode, trays: Record<Colour, string[]>): State {
  const board = BOARDS[boardName]
  const glyphlings = START[boardName].map(([colour, label], i) => ({
    id: `${colour}-${i}`, colour, hex: board.cells.find((h) => board.label(h) === label)!,
  }))
  return { boardName, mode, glyphlings, seeds: [], trays, activeColour: 'yellow', move: null, moveConfirmed: false, cast: null, selected: null, note: null }
}

// ---- what's where, with the pending move and cast applied ----
const posOf = (s: State, g: Glyphling) => (s.move?.id === g.id ? s.move.to : g.hex)
function movesFor(s: State, id: string): Hex[] {
  const blocked = new Set<string>()
  s.glyphlings.forEach((g) => g.id !== id && blocked.add(hexKey(posOf(s, g))))
  s.seeds.forEach((seed) => blocked.add(hexKey(seed.hex)))
  return legalMoves(BOARDS[s.boardName], s.glyphlings.find((g) => g.id === id)!.hex, blocked)
}
function castsFor(s: State): Hex[] {
  if (!s.move) return []
  const owner = new Map<string, Colour>()
  s.glyphlings.forEach((g) => owner.set(hexKey(posOf(s, g)), g.colour))
  s.seeds.forEach((seed) => owner.set(hexKey(seed.hex), seed.colour))
  return legalCasts(BOARDS[s.boardName], s.move.to, owner, s.activeColour)
}
const has = (hexes: Hex[], key: string) => hexes.some((h) => hexKey(h) === key)
const canCast = (s: State) => !!s.move && (s.mode === 'oneCast' || s.moveConfirmed)

function reduce(s: State, a: Action): State {
  const clear = { move: null, cast: null, moveConfirmed: false }
  switch (a.type) {
    case 'newGame':
      return newGame(a.boardName, a.mode, a.trays)
    case 'tapGlyph':
    case 'grabGlyph': {
      const g = s.glyphlings.find((x) => x.id === a.id)!
      if (s.moveConfirmed) return { ...s, note: 'Move confirmed — now cast a seed' }
      if (s.move?.id === a.id) return { ...s, selected: { glyph: a.id }, note: null } // pick a new spot for it
      if (a.type === 'tapGlyph' && s.selected && 'glyph' in s.selected && s.selected.glyph === a.id)
        return { ...s, selected: null }
      return { ...s, ...clear, selected: { glyph: a.id }, activeColour: g.colour, note: null }
    }
    case 'tapSlot':
    case 'grabSlot': {
      if (!s.move) return { ...s, note: 'Move a glyphling first' }
      if (!canCast(s)) return { ...s, note: 'Confirm the move first' }
      if (s.cast?.slot === a.slot) return { ...s, cast: null, selected: { slot: a.slot }, note: null }
      if (a.type === 'tapSlot' && s.selected && 'slot' in s.selected && s.selected.slot === a.slot)
        return { ...s, selected: null }
      return { ...s, selected: { slot: a.slot }, note: null }
    }
    case 'tapHex': {
      const sel = s.selected
      if (sel && 'glyph' in sel && has(movesFor(s, sel.glyph), a.key))
        return { ...s, move: { id: sel.glyph, to: BOARDS[s.boardName].cells.find((h) => hexKey(h) === a.key)! }, cast: null, selected: null, note: null }
      if (sel && 'slot' in sel && canCast(s) && has(castsFor(s), a.key))
        return { ...s, cast: { slot: sel.slot, hex: BOARDS[s.boardName].cells.find((h) => hexKey(h) === a.key)! }, selected: null, note: null }
      if (s.cast && hexKey(s.cast.hex) === a.key) return { ...s, cast: null, note: null } // tap the seed again → back to the tray
      const origin = s.move && s.glyphlings.find((g) => g.id === s.move!.id)!.hex
      if (origin && hexKey(origin) === a.key && !s.moveConfirmed) return { ...s, ...clear, selected: null, note: null } // tap the ghost → glyphling goes back
      return { ...s, selected: null }
    }
    case 'undo':
      if (s.cast) return { ...s, cast: null, note: null }
      if (s.move && !s.moveConfirmed) return { ...s, ...clear, selected: null, note: null }
      return s
    case 'confirmMove':
      return s.move ? { ...s, moveConfirmed: true, selected: null } : s
    case 'commit': {
      if (!s.move || !s.cast) return s
      const letter = s.trays[s.activeColour][s.cast.slot]
      const tray = [...s.trays[s.activeColour]]
      tray[s.cast.slot] = a.newLetter
      return {
        ...s, ...clear, selected: null, note: null,
        glyphlings: s.glyphlings.map((g) => (g.id === s.move!.id ? { ...g, hex: s.move!.to } : g)),
        seeds: [...s.seeds, { hex: s.cast.hex, letter, colour: s.activeColour }],
        trays: { ...s.trays, [s.activeColour]: tray },
      }
    }
  }
}

function prompt(s: State): string {
  if (s.note) return s.note
  if (s.selected && 'glyph' in s.selected) return 'Move it along a glowing line'
  if (s.move && s.mode === 'confirmEach' && !s.moveConfirmed) return 'Confirm the move — or tap its ghost to undo'
  if (s.selected && 'slot' in s.selected) return 'Cast it onto a golden hex'
  if (s.cast) return s.mode === 'oneCast' ? 'Happy? Cast it — or undo' : 'Confirm the cast — or undo'
  if (s.move) return 'Now cast a seed from here'
  return 'Tap or drag a glyphling'
}

// Tuning values that re-render the sketch when the Dev Kit changes them
function useTuningState<T>(file: string, initial: T): T {
  const [value, setValue] = useState<T>(() => liveTuning(file, initial).current)
  useEffect(() => onTuning<T>(file, setValue), [file])
  return value
}

const bag = makeBag(bagFile.seeds)
const deal = () => ({ yellow: Array.from({ length: 8 }, bag.draw), blue: Array.from({ length: 8 }, bag.draw) })

export function Sketch() {
  const [s, setS] = useState<State>(() => newGame('small', 'oneCast', deal()))
  const act = useCallback((a: Action) => setS((prev) => reduce(prev, a)), [])
  const layout = useTuningState('layout', layoutFile)
  const colours = useTuningState('garden', gardenFile)
  const [hexPx, setHexPx] = useState(0)

  // Layout by the SHAPE of the space, not the device: taller than `stackedAspect` → tray below, else beside
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 390, h: 844 })
  useLayoutEffect(() => {
    const el = rootRef.current!
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const stacked = box.h / box.w >= layout.stackedAspect
  const clamp = (v: number) => Math.max(layout.trayTileMin, Math.min(layout.trayTileMax, Math.floor(v)))
  // Tray: one row of 8 if they fit at a comfortable finger size, else 2 rows of 4 (portrait phones have spare height)
  const oneRow = (box.w - 16 - 7 * 6) / 8
  const trayColumns = stacked && oneRow >= layout.trayTileMin ? 8 : 4
  const tile = stacked ? clamp((box.w - 16 - (trayColumns - 1) * 6) / trayColumns) : clamp((box.w * layout.sidePanelShare - 24 - 3 * 6) / 4)

  // ---- taps and drags: one pointer handler for board and tray ----
  const drag = useRef<{ glyph?: string; slot?: number; hex?: string; x: number; y: number; touch: boolean; dragging: boolean } | null>(null)
  const ghostRef = useRef<HTMLImageElement>(null)
  const lift = () => (drag.current?.touch ? layout.dragLift : 0)

  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as Element
    drag.current = {
      glyph: t.closest('[data-glyph]')?.getAttribute('data-glyph') ?? undefined,
      slot: t.closest('[data-slot]') ? Number(t.closest('[data-slot]')!.getAttribute('data-slot')) : undefined,
      hex: t.closest('[data-hex]')?.getAttribute('data-hex') ?? undefined,
      x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', dragging: false,
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || (d.glyph === undefined && d.slot === undefined)) return
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > layout.dragStartDistance) {
      d.dragging = true
      if (d.glyph) act({ type: 'grabGlyph', id: d.glyph })
      else act({ type: 'grabSlot', slot: d.slot! })
      const g = ghostRef.current!
      const glyph = d.glyph && s.glyphlings.find((x) => x.id === d.glyph)
      g.src = glyph ? glyphlingArt(glyph.colour) : seedArt(s.trays[s.activeColour][d.slot!], s.activeColour)
      g.style.width = g.style.height = `${Math.max(tile, hexPx) * 1.2}px`
      g.style.display = 'block'
    }
    if (d.dragging) {
      const g = ghostRef.current!
      g.style.left = `${e.clientX}px`
      g.style.top = `${e.clientY - lift()}px`
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.dragging) {
      ghostRef.current!.style.display = 'none'
      const key = document.elementFromPoint(e.clientX, e.clientY - (d.touch ? layout.dragLift : 0))?.closest('[data-hex]')?.getAttribute('data-hex')
      if (key) act({ type: 'tapHex', key })
      return
    }
    if (d.glyph) act({ type: 'tapGlyph', id: d.glyph })
    else if (d.slot !== undefined) act({ type: 'tapSlot', slot: d.slot })
    else if (d.hex) act({ type: 'tapHex', key: d.hex })
  }

  // ---- what to draw ----
  const board = BOARDS[s.boardName]
  const shownGlyphs = s.glyphlings.map((g) => ({ ...g, hex: posOf(s, g) }))
  const shownSeeds = s.cast ? [...s.seeds, { hex: s.cast.hex, letter: s.trays[s.activeColour][s.cast.slot], colour: s.activeColour, pending: true }] : s.seeds
  const movingGlyph = s.move && s.glyphlings.find((g) => g.id === s.move!.id)
  const ghost = movingGlyph ? { hex: movingGlyph.hex, colour: movingGlyph.colour } : null
  const sel = s.selected
  const highlight = sel && 'glyph' in sel ? { hexes: movesFor(s, sel.glyph), kind: 'move' as const }
    : sel && 'slot' in sel && canCast(s) ? { hexes: castsFor(s), kind: 'cast' as const } : null

  const restart = (boardName: BoardName, mode: Mode) => act({ type: 'newGame', boardName, mode, trays: deal() })
  const commitLabel = s.mode === 'oneCast' ? 'Cast' : 'Confirm cast'

  return (
    <div
      ref={rootRef}
      className={`sketch ${stacked ? 'stacked' : 'side'}`}
      style={{ '--bg': colours.background, '--tile': `${tile}px`, '--panel': `${Math.round(layout.sidePanelShare * 100)}%`, '--tray-columns': trayColumns } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; ghostRef.current!.style.display = 'none' }}
    >
      <header className="bar">
        <div className="toggles">
          <button className={s.boardName === 'small' ? 'on' : ''} onClick={() => restart('small', s.mode)}>Small</button>
          <button className={s.boardName === 'large' ? 'on' : ''} onClick={() => restart('large', s.mode)}>Large</button>
          <span className="sep" />
          <button className={s.mode === 'oneCast' ? 'on' : ''} onClick={() => restart(s.boardName, 'oneCast')}>One Cast</button>
          <button className={s.mode === 'confirmEach' ? 'on' : ''} onClick={() => restart(s.boardName, 'confirmEach')}>Confirm each</button>
        </div>
        <div className="readout">{board.cells.length} hexes · hex {hexPx}px · {stacked ? 'tray below' : 'tray beside'}</div>
      </header>

      <div className="board-area">
        <GardenBoard board={board} glyphlings={shownGlyphs} seeds={shownSeeds} ghost={ghost} highlight={highlight}
          selectedGlyph={sel && 'glyph' in sel ? sel.glyph : null} colours={colours} margin={layout.boardMargin} onHexSize={setHexPx} />
      </div>

      <section className="panel">
        <p className="prompt" style={{ color: s.activeColour === 'yellow' ? '#f2c14e' : '#5fd4f2' }}>{prompt(s)}</p>
        <div className="tray">
          {s.trays[s.activeColour].map((letter, i) => {
            const cast = s.cast?.slot === i
            const selected = sel && 'slot' in sel && sel.slot === i
            return (
              <div key={i} data-slot={i} className={`seed ${selected ? 'selected' : ''} ${cast ? 'used' : ''} ${canCast(s) ? '' : 'waiting'}`}>
                {!cast && <img src={seedArt(letter, s.activeColour)} alt={letter} draggable={false} />}
              </div>
            )
          })}
        </div>
        <div className="actions">
          <button onClick={() => act({ type: 'undo' })} disabled={!s.cast && (!s.move || s.moveConfirmed)}>Undo</button>
          {s.mode === 'confirmEach' && s.move && !s.moveConfirmed
            ? <button className="primary" onClick={() => act({ type: 'confirmMove' })}>Confirm move</button>
            : <button className="primary" disabled={!s.cast} onClick={() => act({ type: 'commit', newLetter: bag.draw() })}>{commitLabel}</button>}
        </div>
      </section>

      <img ref={ghostRef} className="drag-ghost" alt="" draggable={false} />
    </div>
  )
}
