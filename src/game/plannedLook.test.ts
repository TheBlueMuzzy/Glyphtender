import { describe, expect, it } from 'vitest'
import garden from '../../content/tuning/garden.json'
import { brightnessMatrix, channels, PLANNED_LOOKS, plannedLookOf } from './plannedLook'

describe('the planned seed look (B010)', () => {
  it('every look is its own name', () => {
    for (const look of PLANNED_LOOKS) expect(plannedLookOf(look)).toBe(look)
  })
  it('a mistyped look falls back to moonlit', () => {
    expect(plannedLookOf('see-through')).toBe('moonlit')
  })
  it("garden.json's look is a real one (never the old see-through opacity)", () => {
    expect(PLANNED_LOOKS).toContain(garden.plannedSeedLook)
  })
  it('the default keeps the letter legible: moonlit, not the washed-out misty', () => {
    expect(garden.plannedSeedLook).toBe('moonlit')
  })
  it('moonlit keeps the tile dark and the letter light (the brightness gap is what makes it readable)', () => {
    const brightness = (hex: string) => channels(hex).reduce((a, b) => a + b) / 3
    expect(brightness(garden.plannedMoonShadow)).toBeLessThan(0.25)
    expect(brightness(garden.plannedMoonLight)).toBeGreaterThan(0.85)
    expect(brightness(garden.plannedStencilTile)).toBeLessThan(0.25)
    expect(brightness(garden.plannedStencilLetter)).toBeGreaterThan(0.85)
  })
  it('reads hex colours as 0–1 channels', () => {
    expect(channels('#ff8000')).toEqual([1, 128 / 255, 0])
  })
  it('the brightness matrix turns every colour grey, lifted by the boost, and leaves alpha alone', () => {
    const rows = brightnessMatrix(2).split('  ').map((r) => r.split(' ').map(Number))
    expect(rows).toHaveLength(4)
    for (const row of rows.slice(0, 3)) expect(row).toEqual([0.4252, 1.4304, 0.1444, 0, 0])
    expect(rows[3]).toEqual([0, 0, 0, 1, 0])
  })
})
