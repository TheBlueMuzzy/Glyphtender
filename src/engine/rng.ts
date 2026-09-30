// Seeded random numbers (mulberry32) — the same seed always gives the same numbers,
// so a game can be replayed from its seed + actions. The generator's position is a plain
// number kept in GameState, so every function here takes it in and hands back the next one.

/** One random number in [0, 1), plus the next generator position. */
export function nextRandom(rng: number): { value: number; rng: number } {
  const next = (rng + 0x6d2b79f5) | 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, rng: next }
}

/** A whole number from 0 up to (not including) `max`. */
export function randomInt(rng: number, max: number): { value: number; rng: number } {
  const r = nextRandom(rng)
  return { value: Math.floor(r.value * max), rng: r.rng }
}

/** A shuffled copy of `items` (Fisher–Yates). The input is not changed. */
export function shuffle<T>(rng: number, items: readonly T[]): { items: T[]; rng: number } {
  const out = [...items]
  let pos = rng
  for (let i = out.length - 1; i > 0; i--) {
    const r = randomInt(pos, i + 1)
    pos = r.rng
    const j = r.value
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return { items: out, rng: pos }
}
