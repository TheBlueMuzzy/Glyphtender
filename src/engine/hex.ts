// Hex grid maths for the garden board.
// Flat-top hexes, axial coordinates (q = column, r = slanted row) — the Red Blob Games standard.
// Boards are authored the way Muzzy draws them: a list of column heights, e.g. [4,7,8,9,10,9,10,9,8,7,4].

export interface Hex {
  q: number
  r: number
}

/** The 6 directions. Opposite directions are 3 apart (i and i+3). */
export const DIRECTIONS: readonly Hex[] = [
  { q: 0, r: -1 }, // 0 N
  { q: 1, r: -1 }, // 1 NE
  { q: 1, r: 0 }, // 2 SE
  { q: 0, r: 1 }, // 3 S
  { q: -1, r: 1 }, // 4 SW
  { q: -1, r: 0 }, // 5 NW
]

/** The 3 leylines (axes words are read along): N–S, NE–SW, NW–SE — each as the direction words read in. */
export const LEYLINES: readonly Hex[] = [
  DIRECTIONS[3], // top → bottom
  DIRECTIONS[2], // NW → SE (left to right, going down)
  DIRECTIONS[1], // SW → NE (left to right, going up)
]

export const hexKey = (h: Hex) => `${h.q},${h.r}`
export const addHex = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r })
export const sameHex = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r

export interface Board {
  /** Column heights the board was made from. */
  columns: number[]
  cells: Hex[]
  has: (h: Hex) => boolean
  /** Designer notation, e.g. "C4-3" = column 4, 3rd hex from the top. */
  label: (h: Hex) => string
}

/**
 * Builds a board from column heights. Columns are centred on each other, so neighbouring
 * columns sit half a hex apart (heights alternate odd/even, as on Muzzy's paper board).
 */
export function boardFromColumns(columns: number[]): Board {
  const cells: Hex[] = []
  const labels = new Map<string, string>()
  columns.forEach((height, col) => {
    const top = -Math.floor((height + col) / 2)
    for (let i = 0; i < height; i++) {
      const hex = { q: col, r: top + i }
      cells.push(hex)
      labels.set(hexKey(hex), `C${col + 1}-${i + 1}`)
    }
  })
  const keys = new Set(cells.map(hexKey))
  return {
    columns,
    cells,
    has: (h) => keys.has(hexKey(h)),
    label: (h) => labels.get(hexKey(h)) ?? '?',
  }
}

/** Neighbouring hexes that are on the board. */
export function neighbours(board: Board, h: Hex): Hex[] {
  return DIRECTIONS.map((d) => addHex(h, d)).filter(board.has)
}

/** An edge hex has fewer than 6 neighbours on the board. */
export function isEdge(board: Board, h: Hex): boolean {
  return neighbours(board, h).length < 6
}

/** Hexes in a straight line from `from` (not included) in `dir`, until the board ends. */
export function ray(board: Board, from: Hex, dir: Hex): Hex[] {
  const out: Hex[] = []
  let h = addHex(from, dir)
  while (board.has(h)) {
    out.push(h)
    h = addHex(h, dir)
  }
  return out
}

/** Centre of a hex in pixels, for a flat-top hex of the given size (centre to corner). */
export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * 1.5 * h.q, y: size * Math.sqrt(3) * (h.r + h.q / 2) }
}

/** The 6 corner points of a flat-top hex, as an SVG points string. */
export function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
