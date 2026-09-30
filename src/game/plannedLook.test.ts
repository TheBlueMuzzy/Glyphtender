import { describe, expect, it } from 'vitest'
import garden from '../../content/tuning/garden.json'
import { PLANNED_LOOKS, plannedLookOf } from './plannedLook'

describe('the planned seed look (B010)', () => {
  it('every look is its own name', () => {
    for (const look of PLANNED_LOOKS) expect(plannedLookOf(look)).toBe(look)
  })
  it('a mistyped look falls back to misty', () => {
    expect(plannedLookOf('see-through')).toBe('misty')
  })
  it("garden.json's look is a real one (never the old see-through opacity)", () => {
    expect(PLANNED_LOOKS).toContain(garden.plannedSeedLook)
  })
})
