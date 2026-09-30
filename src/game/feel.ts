// GAME FEEL — how big each bit of "juice" is, by tier (small / medium / big) from content/tuning/feel.json
// (the game-feel way: moments pick a tier, tiers hold the numbers — Muzzy tunes them in the Dev Kit → Tuning).
// Reduce motion is handled where the juice plays: no pulse, no shake, and only the score total.
import feelFile from '../../content/tuning/feel.json'
import { liveTuning } from '../devkit/tuning/liveTuning'

export type FeelEvent = keyof typeof feelFile.events
export type Juice = { grow: number; shake: number }

const feelTuning = liveTuning('feel', feelFile)

/** The juice for one moment, e.g. juiceFor('seedPop').grow = how far a seed's "+1" swells past full size. */
export function juiceFor(event: FeelEvent): Juice {
  const feel = feelTuning.current // read now, so a Dev Kit change applies to the next one
  const tier = feel.events[event] as keyof typeof feel.tiers
  return feel.tiers[tier] ?? feel.tiers.small // a mistyped tier name falls back to small
}
