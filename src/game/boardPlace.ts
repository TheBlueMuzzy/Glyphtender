// WHERE THE BOARD SITS IN ITS BOX — the board always fits its box; the room left over (on one side) is shared
// so the board sits close to the tray: tall layouts put it right on the tray (all the room on the far side);
// wide layouts leave only an eighth of the room on the tray's side (measured: about half the old centred gap,
// once the board's margin and the column's padding are counted — Muzzy: "the seed tray about half as far").

/** Which side of the board's box the tray is on. */
export type TraySide = 'bottom' | 'top' | 'right' | 'left'

/**
 * How far to move the board from the middle of its box toward the tray, in board units (hex sizes).
 * spareX / spareY: the box's room left over around the board, in the same units (one of them is 0).
 */
export function boardShift(side: TraySide, spareX: number, spareY: number): { x: number; y: number } {
  if (side === 'bottom') return { x: 0, y: spareY / 2 }
  if (side === 'top') return { x: 0, y: -spareY / 2 }
  if (side === 'right') return { x: (spareX * 3) / 8, y: 0 }
  return { x: (-spareX * 3) / 8, y: 0 }
}

/**
 * The board's own area plus its margin (layout.json boardMargin, in hex sizes), in board units — the SVG viewBox.
 * Hexes are drawn at size 1 (useThrow HEX); a flat-top hex reaches 1 to each side of its centre.
 */
export function boardView(cells: { q: number; r: number }[], margin: number): { minX: number; minY: number; w: number; h: number } {
  const points = cells.map((h) => ({ x: 1.5 * h.q, y: Math.sqrt(3) * (h.r + h.q / 2) })) // hexToPixel at size 1
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const pad = margin + 1
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
  return { minX, minY, w: Math.max(...xs) + pad - minX, h: Math.max(...ys) + pad - minY }
}
