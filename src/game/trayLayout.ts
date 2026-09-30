// How big the tray seeds are and how they're arranged (GDD §4 "Seed tray size", TDD §2b "Tray").
// Seeds are REAL SIZE: as wide as a hex on the board, never smaller than a finger (trayTileMin).
// If a row of 8 doesn't fit, the tray wraps to 2 rows of 4 rather than shrinking;
// only if 4 still don't fit do they shrink (never below trayTileMin).

export interface TrayLayout {
  columns: number
  rows: number
  /** One seed's width and height, in pixels. */
  tile: number
  /** The whole tray's size, in pixels. */
  width: number
  height: number
}

export interface TrayInput {
  /** How much width the tray may use, in pixels. */
  room: number
  /** How wide one hex is on the board right now, in pixels. */
  hexPx: number
  /** How many slots to lay out (a full hand, so the tray doesn't jump as seeds come and go). */
  slots: number
  tileMin: number
  gap: number
}

export function trayLayout({ room, hexPx, slots, tileMin, gap }: TrayInput): TrayLayout {
  const widthOf = (columns: number, tile: number) => columns * tile + (columns - 1) * gap
  let tile = Math.max(tileMin, Math.round(hexPx))
  let columns = slots
  if (widthOf(columns, tile) > room) columns = Math.ceil(slots / 2) // wrap to 2 rows first…
  if (widthOf(columns, tile) > room) tile = Math.max(tileMin, Math.floor((room - (columns - 1) * gap) / columns)) // …then shrink
  const rows = Math.ceil(slots / columns)
  return { columns, rows, tile, width: widthOf(columns, tile), height: rows * tile + (rows - 1) * gap }
}
