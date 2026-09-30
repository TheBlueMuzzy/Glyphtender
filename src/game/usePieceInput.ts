// TAP-TAP AND DRAG — one pointer handler for the whole game screen (board + tray), finger and mouse alike.
// A press that moves more than dragStartDistance becomes a drag: the piece floats under the pointer
// (dragLift px ABOVE a finger, so the finger doesn't hide it) and dropping it = tapping where it's dropped.
// What was pressed is read from data attributes:
//   data-glyph (board glyphling id) · data-hand (tray seed: hand index) + data-tray-pos (its place in the tray)
//   data-draft (a glyphling waiting to be placed) · data-hex (a board hex, "q,r")
import { useRef, type PointerEvent, type RefObject } from 'react'
import type { Hex } from '../engine/hex'
import { useGameStore } from '../store/gameStore'
import { glyphlingArt, seedArt } from './art'
import type { LayoutTuning } from './useTuning'

interface Press {
  glyph?: number
  hand?: number
  trayPos?: number
  draft?: boolean
  hex?: Hex
  x: number
  y: number
  touch: boolean
  dragging: boolean
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
      store().grabGlyphling(p.glyph)
      const g = game.glyphlings.find((x) => x.id === p.glyph)
      if (g && g.seat === game.current && game.phase === 'play' && !game.tangled.includes(g.id)) art = glyphlingArt(g.seat)
    } else if (p.hand !== undefined) {
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
    const t = e.target as Element
    press.current = {
      glyph: numberAttr(t, 'data-glyph'),
      hand: numberAttr(t, 'data-hand'),
      trayPos: numberAttr(t, 'data-tray-pos'),
      draft: !!t.closest('[data-draft]'),
      hex: hexAttr(t),
      x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', dragging: false,
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const p = press.current
    if (!p || (p.glyph === undefined && p.hand === undefined && !p.draft)) return
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > layout.dragStartDistance) startDrag(p)
    if (p.dragging) place(e)
  }

  const onPointerUp = (e: PointerEvent) => {
    const p = press.current
    press.current = null
    if (!p) return
    if (p.dragging) {
      place(e, false)
      // Where the piece was shown (lifted above a finger), not where the finger is
      const dropped = document.elementFromPoint(e.clientX, e.clientY - (p.touch ? layout.dragLift : 0))
      const trayPos = dropped ? numberAttr(dropped, 'data-tray-pos') : undefined
      if (p.hand !== undefined && p.trayPos !== undefined && trayPos !== undefined) return store().moveTraySeed(p.trayPos, trayPos)
      const hex = hexAttr(dropped)
      if (hex) store().tapHex(hex)
      return
    }
    if (p.glyph !== undefined) store().tapGlyphling(p.glyph)
    else if (p.hand !== undefined) store().tapSeed(p.hand)
    else if (p.hex) store().tapHex(p.hex)
  }

  const onPointerCancel = (e: PointerEvent) => {
    press.current = null
    place(e, false)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
