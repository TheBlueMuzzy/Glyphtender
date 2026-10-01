// WORD SPOTLIGHT LOOP (F25) — plays the loop on the word groups WordBorders / WordLabels draw: each word's border
// (and its label) lights in its own slot, round and round. Web Animations, so no React state per frame.
import { useLayoutEffect, type RefObject } from 'react'
import { hexKey } from '../engine/hex'
import { reduceMotion } from '../ui/kit'
import { spotlightFrames, spotlightSlot } from './spotlight'
import type { AnimTuning } from './useTuning'
import type { SpotKind, SpotWord } from './WordBorders'

/** The same words → the same id, so the loop only restarts when the words change. */
const wordsId = (words: SpotWord[]) => words.map((w) => `${w.word}@${w.hexes.map(hexKey).join(';')}`).join('|')

/**
 * Plays the loop for one kind of words: each word's border (and its label) lights in its own slot, round and round,
 * restarting whenever the words change. `labels`: whether labels are drawn (they join the loop when they appear).
 */
export function useWordSpotlight(svgRef: RefObject<SVGSVGElement | null>, kind: SpotKind, words: SpotWord[], grownKey: number,
  peak: number, timing: AnimTuning, labels: boolean) {
  const id = wordsId(words)
  const count = words.length
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg || count < 2) return
    const fade = reduceMotion() ? 0 : timing.spotlightFade
    const hold = timing.spotlightHold
    const loop = spotlightSlot(hold, fade) * count * 1000
    const playing: Animation[] = []
    for (let i = 0; i < count; i++) {
      const frames = spotlightFrames(i, count, hold, fade, peak)
      svg.querySelectorAll(`[data-spot-of="${kind}"][data-spot-word="${i}"]`).forEach((el) => {
        playing.push(el.animate(frames, { duration: loop, iterations: Infinity }))
      })
    }
    return () => playing.forEach((a) => a.cancel())
  }, [svgRef, kind, id, count, grownKey, peak, timing.spotlightHold, timing.spotlightFade, labels])
}
