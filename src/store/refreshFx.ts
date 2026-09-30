// THE REFRESH, PLAYED OUT (B011 — Muzzy: "the tiles they selected shrink, and new ones scale into their place.
// THEN it goes to the next player"). Plain maths for it; the store runs the stages, the tray (SeedTray.tsx) draws them:
//   out  — each set-aside seed shrinks away, one slot after the next (anim.json refreshShrinkTime, refreshStagger)
//   gone — online only: shrunk, waiting for the server's new seeds (the slots stay empty)
//   in   — the new seeds grow into those same slots, with a small overshoot (refreshGrowTime; feel.json refreshGrow)
// Only then does play pass on (the handoff). Keep all, or reduce motion → no animation, it just happens.
import type { AnimTuning } from '../game/useTuning'

export interface RefreshFx {
  /** Whose tray is refreshing. */
  seat: number
  /** Tray positions (left to right, top row first) whose seeds go. */
  slots: number[]
  /** Stage "in": the tray positions the new seeds grow into (the set-aside places, and a cast seed's empty place). */
  newSlots?: number[]
  stage: 'out' | 'gone' | 'in'
  /** Pass-and-play, stage "in": the new hand and tray order, shown before the game moves on to the next player. */
  hand?: string[]
  order?: number[]
}

/** The tray positions of the set-aside seeds (hand indexes), left to right. */
export function refreshSlots(order: number[], setAside: number[]): number[] {
  return order.flatMap((index, pos) => (setAside.includes(index) ? [pos] : []))
}

/** The tray order after a refresh: every new seed takes a set-aside seed's place (kept seeds stay where they were).
 *  The engine's new hand is [...kept, ...drawn], so kept seeds' indexes shift down past the removed ones.
 *  If the bag ran short, the places left over close up; any extra new seed goes on the end. */
export function refillInPlace(order: number[], removed: number[], newLength: number): number[] {
  let fresh = order.filter((i) => !removed.includes(i)).length // the first drawn seed's hand index
  const next: number[] = []
  for (const i of order) {
    if (!removed.includes(i)) next.push(i - removed.filter((r) => r < i).length)
    else if (fresh < newLength) next.push(fresh++)
  }
  while (fresh < newLength) next.push(fresh++)
  return next
}

/** The tray positions holding new seeds after a refresh (hand indexes from `keptCount` on are the drawn ones). */
export function newSeedSlots(order: number[], keptCount: number): number[] {
  return order.flatMap((index, pos) => (index >= keptCount ? [pos] : []))
}

/** How long each stage lasts, in ms (the last slot's stagger included; the pause sits after the shrink).
 *  Nothing set aside, or reduce motion → 0 and 0: the refresh just happens. */
export function refreshTimes(slots: number, timing: AnimTuning, reduce: boolean): { shrinkMs: number; growMs: number } {
  if (slots === 0 || reduce) return { shrinkMs: 0, growMs: 0 }
  const stagger = timing.refreshStagger * (slots - 1)
  return {
    shrinkMs: Math.round((timing.refreshShrinkTime + stagger + timing.refreshPause) * 1000),
    growMs: Math.round((timing.refreshGrowTime + stagger) * 1000),
  }
}
