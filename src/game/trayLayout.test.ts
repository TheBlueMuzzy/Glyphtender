import { describe, expect, it } from 'vitest'
import { trayLayout } from './trayLayout'

const base = { slots: 8, tileMin: 44, gap: 6 }

describe('tray size (GDD §4 "Seed tray size")', () => {
  it('seeds are the same size as a hex on the board when 8 fit in a row', () => {
    expect(trayLayout({ ...base, room: 1000, hexPx: 90 })).toMatchObject({ columns: 8, rows: 1, tile: 90 })
  })

  it('never smaller than a finger (44 px), even when board hexes are smaller', () => {
    expect(trayLayout({ ...base, room: 1000, hexPx: 38 }).tile).toBe(44)
  })

  it('wraps to 2 rows of 4 rather than shrinking', () => {
    // phone portrait: 374 px of room, 42 px hexes → 8 × 44 + gaps = 394 doesn't fit
    expect(trayLayout({ ...base, room: 374, hexPx: 42 })).toMatchObject({ columns: 4, rows: 2, tile: 44 })
    // desktop side panel: 410 px of room, 97 px hexes → 4 × 97 + gaps = 406 fits at full size
    expect(trayLayout({ ...base, room: 410, hexPx: 97 })).toMatchObject({ columns: 4, rows: 2, tile: 97 })
  })

  it('only shrinks when even 4 in a row do not fit — and never below the minimum', () => {
    expect(trayLayout({ ...base, room: 300, hexPx: 97 })).toMatchObject({ columns: 4, tile: 70 })
    expect(trayLayout({ ...base, room: 150, hexPx: 97 }).tile).toBe(44)
  })
})
