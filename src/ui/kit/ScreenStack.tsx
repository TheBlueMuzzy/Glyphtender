// SCREEN STACK (React) — draws the open screens on top of the game, newest on top.
//   <ScreenStack screens={{ settings: SettingsScreen, quit: QuitDialog }}>
//     <GameHud />            ← the always-there bottom layer
//   </ScreenStack>
// Each screen is a component that returns a <Screen>. A dialog is just <Screen dialog> pushed on top.
// Everything under the top screen is inert: it can't be clicked, tapped or focused. Open screens under the top one
// are also hidden (so a Pause panel never peeks out from behind the Rules opened from it): only the top screen shows,
// over one dim (a screen opened over another always dims, dialog or not); the one under it comes back when it closes.
// The game (children) stays visible under the dim.
//
// overlay: for a game whose own view isn't built from kit Screens (a letterboxed canvas, its own HUD
// with z-indexes). Put <ScreenStack overlay screens={…} /> next to the game, with no children:
// open screens then cover the whole window above the game (at --kit-overlay-z, default 100), dim it
// and block taps to it. Tapping the dim closes the top screen, like Esc and Back.
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { screens as store } from './screens'

// Until a key is pressed, a screen that opens shouldn't show the keyboard focus ring
// (browsers show it for focus moved by code before any click or key, e.g. a screen opened at load).
let keyPressed = false
if (typeof window !== 'undefined') window.addEventListener('keydown', () => { keyPressed = true }, { once: true, capture: true })

type ScreenStackProps = { screens: Record<string, ComponentType>; children?: ReactNode; overlay?: boolean }

export function useScreens() {
  return useSyncExternalStore(store.subscribe, () => store.current, () => store.current)
}

export function ScreenStack({ screens, children, overlay }: ScreenStackProps) {
  const stack = useScreens()
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const openers = useRef<(Element | null)[]>([]) // what had focus when each screen opened
  const depth = stack.length
  const top = depth ? `${depth}-${stack[depth - 1]}` : '' // which screen is on top, e.g. "2-shop"

  // Everything under the top screen is inert. Set straight on the page (not as an inert={…} prop,
  // which only React 19 understands), and before the focus code below runs, so a closing screen's
  // opener is clickable again by the time focus goes back to it.
  // Layer 0 is the game (children); layer 1 is the first open screen, and so on.
  // Open screens under the top one (layers 1 … depth-1) are hidden too: data-covered → visibility hidden (kit.css),
  // which keeps their scroll position and state for when they come back.
  useLayoutEffect(() => {
    layers.current.forEach((layer, i) => {
      layer?.toggleAttribute('inert', i < depth)
      layer?.toggleAttribute('data-covered', i > 0 && i < depth)
    })
  }, [depth, top])

  // Keyboard/gamepad focus: into a screen when it opens (or is swapped in by replace),
  // back to its opener when it closes.
  const last = useRef({ depth, top })
  // Noted while drawing, before the screen below turns inert and drops its focus.
  if (depth > last.current.depth) openers.current[depth - 1] = document.activeElement
  useEffect(() => {
    if (depth < last.current.depth) {
      (openers.current[depth] as HTMLElement | null)?.focus?.()
    } else if (top !== last.current.top) {
      // A new top screen: opened, or swapped in by replace (same depth, so it keeps the old opener).
      // The first button or input; a scroll box only if there's nothing else (it would wear the focus ring)
      const layer = layers.current[depth]
      const first = layer?.querySelector<HTMLElement>('button:not(:disabled), input') ?? layer?.querySelector<HTMLElement>('[tabindex="0"]')
      // ("as FocusOptions": older TypeScript versions, like many games use, don't know focusVisible yet)
      first?.focus(keyPressed ? undefined : ({ focusVisible: false } as FocusOptions))
    }
    last.current = { depth, top }
  }, [depth, top])

  const open = stack.map((name, i) => {
    const Screen = screens[name]
    return (
      // data-over: opened on top of another screen — it carries the dim (the one under it is hidden), there at once
      <div key={`${i}-${name}`} className="kit-layer" data-over={i > 0 || undefined} ref={(el) => { layers.current[i + 1] = el }}>
        {Screen ? <Screen /> : null}
      </div>
    )
  })

  return (
    <>
      <div className="kit-layer" ref={(el) => { layers.current[0] = el }}>{children}</div>
      {overlay
        ? <div className="kit-overlay" data-open={depth > 0 || undefined}
            onClick={(e) => { if (e.target === e.currentTarget) store.pop() }}>{open}</div>
        : open}
    </>
  )
}
