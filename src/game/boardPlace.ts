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
