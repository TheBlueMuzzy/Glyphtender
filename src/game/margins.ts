// THE GAME SCREEN'S MARGINS — room around the edges, and (board beside the tray) even gaps.
// Muzzy's playtest: "looks like it has no margins" (desktop) and "the profile icon and the menu buttons are really
// close to the edge … feels cramped" (phone). So every layout keeps a margin on all four sides (on top of the phone's
// safe area), and when the board sits BESIDE the tray the spare width is shared out so the gaps
// edge | board | column | edge all look the same ("evenly spaced between the edges").
// The sizes become empty SVG rulers in the grid (game.css) — sizes are SVG attributes there (TDD D13).

/** How wide the margin round the edges is, in px: layout.json edgeMargin, or edgeMarginShare of the shorter side
 *  of the screen if that's more (a big screen gets a bigger margin). */
export function edgeMargin(width: number, height: number, min: number, share: number): number {
  return Math.round(Math.max(min, share * Math.min(width, height)))
}

export interface SideGapInput {
  /** The free space (inside the safe area), px. */
  width: number
  height: number
  /** The margin round the edges (edgeMargin), px. */
  edge: number
  /** The grid's gap between tracks, px (it sits next to every ruler). */
  gap: number
  /** The side column's width, px, and how wide its contents (the tray) are — it's centred in the column. */
  column: number
  content: number
  /** The board's width ÷ height (its viewBox), and its own empty margin on each side as a share of its width. */
  aspect: number
  insetShare: number
}

/** Widths of the three empty rulers (px, never below 0) in the side layout: on the board's outer side, between the
 *  board and the column, and on the column's outer side. The board's box takes what's left — exactly as wide as the
 *  board at the full height, so the hexes and the tray end up with even gaps between them and the edges.
 *  When the screen is too narrow for that, the board fills the width between the margins instead. */
export function sideGaps(p: SideGapInput): { board: number; middle: number; column: number } {
  const columnSpare = Math.max(0, (p.column - p.content) / 2) // the column's own room either side of the tray
  const { gap, boardW } = evenGap(p)
  const inset = boardW * p.insetShare // the hexes start this far inside the box
  return {
    board: Math.max(0, gap - p.gap - inset),
    middle: Math.max(0, gap - 2 * p.gap - inset - columnSpare),
    // the column's own box (the turn bar's ☰) never closer to the edge than the margin
    column: Math.max(0, gap - p.gap - columnSpare, p.edge - p.gap),
  }
}

/** The even gap you SEE (edge | board | tray | edge) in the side layout, px, and the board box's width. */
function evenGap(p: SideGapInput): { gap: number; boardW: number } {
  // The board's box at the full height (between the top and bottom margins)…
  let boardW = Math.max(0, p.height - 2 * p.edge) * p.aspect
  // …what you SEE of it is the hexes (the box less its own margin, each side) and the tray: the rest of the width
  // is shared into 3 equal gaps
  let gap = (p.width - boardW * (1 - 2 * p.insetShare) - p.content) / 3
  if (gap < p.edge) {
    // too narrow for the board at full height: every gap is the margin, and the board takes the width that leaves
    gap = p.edge
    boardW = Math.max(0, (p.width - p.content - 3 * gap) / (1 - 2 * p.insetShare))
  }
  return { gap, boardW }
}

/** Side layout: how far the prompt line may reach out past the column's left side, px — the empty gap there (between
 *  the board's hexes, or the screen's edge, and the column's box), less a margin kept clear. The glyphling beside the
 *  prompt hangs out into it, so the words keep the column's full width (no extra wrapping on a phone on its side). */
export function promptHangRoom(p: SideGapInput): number {
  const columnSpare = Math.max(0, (p.column - p.content) / 2)
  return Math.max(0, evenGap(p).gap - columnSpare - p.edge)
}
