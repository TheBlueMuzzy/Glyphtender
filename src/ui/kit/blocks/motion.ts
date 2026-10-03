// MOTION — the few bits of animation that have to happen in code (counting a number up),
// driven by the same things the CSS uses: the style's motion times and the reduce-motion switch.
import { useEffect, useRef, useState } from 'react'

// True when motion should stop: the kit's Settings switch (data-reduce-motion on the page)
// or the device's own "reduce motion" setting.
export function reduceMotion() {
  if (typeof document === 'undefined') return false
  if (document.documentElement.hasAttribute('data-reduce-motion')) return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

// '420ms' → 420, '0.3s' → 300, anything else → the fallback.
export function toMilliseconds(time: string, fallback = 0) {
  const match = time.trim().match(/^([\d.]+)(ms|s)$/)
  if (!match) return fallback
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}

// How long one of the style's motion times is right now, in milliseconds ('motion-fast' / 'motion-normal').
// 0 when motion is reduced.
export function motionTime(name: 'motion-fast' | 'motion-normal') {
  if (reduceMotion() || typeof document === 'undefined') return 0
  return toMilliseconds(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`), 300)
}

// COUNT UP — shows a number that rolls up to its new value when it goes up (over two of the
// style's normal motion times). Going down, or with reduce motion on, it just changes.
export function useCountUp(value: number) {
  const [shown, setShown] = useState(value)
  const shownNow = useRef(value) // the number on screen this moment, for the next count to start from
  useEffect(() => {
    const from = shownNow.current
    const duration = motionTime('motion-normal') * 2
    if (value <= from || duration <= 0) {
      shownNow.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, Math.max(0, (now - start) / duration)) // (a frame can be stamped just before start: never count below `from`)
      shownNow.current = Math.round(from + (value - from) * progress)
      setShown(shownNow.current)
      if (progress < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}
