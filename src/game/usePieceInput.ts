// TAP-TAP AND DRAG — one pointer handler for the whole game screen (board + tray), finger and mouse alike.
// A press that moves more than dragStartDistance becomes a drag: the piece floats under the pointer
// (dragLift px ABOVE a finger, so the finger doesn't hide it) and dropping it = tapping where it's dropped.
// While dragging, the legal hex under the floating piece lights up ("drop here", dropTarget.ts); an illegal one doesn't.
// A tap or drag on something that can't be touched makes it shake "no" (store.refuseTap → nope.ts).
// What was pressed is read from data attributes:
//   data-glyph (board glyphling id) · data-hand (tray seed: hand index) + data-tray-pos (its place in the tray)
//   data-draft (a glyphling waiting to be placed) · data-hex (a board hex, "q,r")
import { useRef, type PointerEvent, type RefObject } from 'react'
import type { Hex } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { dropKind } from '../store/turnPlan'
import { glyphlingArt, seedArt } from './art'
import { showDropTarget } from './dropTarget'
import type { LayoutTuning } from './useTuning'

interface Press {
  glyph?: number
  hand?: number
  trayPos?: number
  draft?: boolean
  hex?: Hex
  /** Which finger (or mouse) is pressing � a second finger is ignored until this one lifts. */
  pointerId: number
  x: number
  y: number
  touch: boolean
  dragging: boolean
  /** The piece said "no" when a drag started (it shook): the rest of this press does nothing. */
  refused?: boolean
}

const numberAttr = (el: Element, name: string) => {
  const found = el.closest(`[${name}]`)
  return found ? Number(found.getAttribute(name)) : undefined
}
const hexAttr = (el: Element | null): Hex | undefined => {
  const key = el?.closest('[data-hex]')?.getAttribute('data-hex')
  if (!key) return undefined
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export interface DragLayer {
  layer: RefObject<SVGSVGElement | null>
  image: RefObject<SVGImageElement | null>
}

/** Pointer handlers to spread on the game screen. `size` = how big the floating piece is drawn (px). */
export function usePieceInput(drag: DragLayer, layout: LayoutTuning, size: number) {
  const press = useRef<Press | null>(null)
  const store = useGameStore.getState

  // Show the floating piece under the pointer (or hide it with show = false)
  const place = (e: PointerEvent, show = true) => {
    const img = drag.image.current, layer = drag.layer.current
    if (!img || !layer) return
    if (!show) return img.setAttribute('visibility', 'hidden')
    const box = layer.getBoundingClientRect()
    const lift = press.current?.touch ? layout.dragLift : 0
    img.setAttribute('x', String(e.clientX - box.left - size / 2))
    img.setAttribute('y', String(e.clientY - box.top - lift - size / 2))
    img.setAttribute('visibility', 'visible')
  }

  const startDrag = (p: Press) => {
    const { game } = store()
    const img = drag.image.current
    if (!game || !img) return
    let art: string | null = null
    if (p.glyph !== undefined) {
      const refused = store().refuseTap({ glyph: p.glyph })
      store().grabGlyphling(p.glyph) // (a refused one still says why in the prompt)
      if (refused) return void (p.refused = true)
      const g = game.glyphlings.find((x) => x.id === p.glyph)
      if (g && g.seat === game.current && game.phase === 'play' && !game.tangled.includes(g.id)) art = glyphlingArt(g.seat)
    } else if (p.hand !== undefined) {
      if (store().refuseTap({ hand: p.hand, drag: true })) return void (p.refused = true) // (not my turn)
      store().grabSeed(p.hand)
      art = seedArt(game.hands[game.current][p.hand], game.current)
    } else if (p.draft) {
      art = glyphlingArt(game.current)
    }
    if (!art) return
    img.setAttribute('href', art)
    img.setAttribute('width', String(size))
    img.setAttribute('height', String(size))
    p.dragging = true
  }

  const onPointerDown = (e: PointerEvent) => {
    if (store().flying) return // nothing to touch while a seed is in the air
    if (!e.isPrimary) return // only the first finger plays; a second finger (or a palm) is ignored
    if (e.button !== 0) return // only the main mouse button (a finger or pen tip is 0 too); right/middle clicks do nothing
    const t = e.target as Element
    press.current = {
      glyph: numberAttr(t, 'data-glyph'),
      hand: numberAttr(t, 'data-hand'),
      trayPos: numberAttr(t, 'data-tray-pos'),
      draft: !!t.closest('[data-draft]'),
      hex: hexAttr(t),
      pointerId: e.pointerId,
      x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', dragging: false,
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const p = press.current
    if (!p || p.refused || e.pointerId !== p.pointerId || (p.glyph === undefined && p.hand === undefined && !p.draft)) return
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > layout.dragStartDistance) startDrag(p)
    if (!p.dragging) return
    place(e)
    const hex = hexAttr(underPiece(e, p))
    const { game, move, selected } = store()
    showDropTarget(hex, game ? dropKind(game, move, selected, hex) : null)
  }

  // What's under the floating piece (lifted above a finger), not under the finger itself
  const underPiece = (e: PointerEvent, p: Press) => document.elementFromPoint(e.clientX, e.clientY - (p.touch ? layout.dragLift : 0))

  const onPointerUp = (e: PointerEvent) => {
    const p = press.current
    if (!p || e.pointerId !== p.pointerId) return
    press.current = null
    if (p.refused) return // it already shook when the drag started
    if (p.dragging) {
      place(e, false)
      showDropTarget(undefined, null)
      const dropped = underPiece(e, p)
      const trayPos = dropped ? numberAttr(dropped, 'data-tray-pos') : undefined
      if (p.hand !== undefined && p.trayPos !== undefined && trayPos !== undefined) return store().moveTraySeed(p.trayPos, trayPos)
      const hex = hexAttr(dropped)
      if (hex) store().tapHex(hex)
      return
    }
    // A tap: a piece that can't be touched shakes "no", then the tap goes on as usual (a note may say why)
    if (p.glyph !== undefined) {
      store().refuseTap({ glyph: p.glyph })
      store().tapGlyphling(p.glyph)
    } else if (p.hand !== undefined) {
      store().refuseTap({ hand: p.hand })
      store().tapSeed(p.hand)
    } else if (p.hex) {
      store().refuseTap({ hex: p.hex })
      store().tapHex(p.hex)
    }
  }

  const onPointerCancel = (e: PointerEvent) => {
    if (press.current?.pointerId !== e.pointerId) return
    press.current = null
    place(e, false)
    showDropTarget(undefined, null)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
