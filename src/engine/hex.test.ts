import { describe, expect, it } from 'vitest'
import { DIRECTIONS, boardFromColumns, hexToPixel, isEdge, neighbours, ray, sameHex } from './hex'
import boards from '../../content/data/boards.json'

const small = boardFromColumns(boards.small.columns)
const large = boardFromColumns(boards.large.columns)
const find = (board: ReturnType<typeof boardFromColumns>, label: string) =>
  board.cells.find((h) => board.label(h) === label)!

describe('boards from column heights', () => {
  it('have the right number of hexes', () => {
    expect(small.cells.length).toBe(85)
    expect(large.cells.length).toBe(117)
  })

  it('label hexes in designer notation', () => {
    expect(small.label(small.cells[0])).toBe('C1-1')
    expect(find(small, 'C6-5')).toBeDefined()
  })

  it('are mirror-symmetric left to right (same shape both sides)', () => {
    const ys = (b: typeof small, col: number) =>
      b.cells.filter((h) => h.q === col).map((h) => hexToPixel(h, 1).y.toFixed(3))
    const n = small.columns.length
    for (let c = 0; c < n; c++) expect(ys(small, c)).toEqual(ys(small, n - 1 - c))
  })
})

describe('neighbours and lines', () => {
  it('a middle hex has 6 neighbours, a corner hex fewer', () => {
    const middle = find(small, 'C6-5')
    expect(neighbours(small, middle)).toHaveLength(6)
    expect(isEdge(small, middle)).toBe(false)
    expect(isEdge(small, find(small, 'C1-1'))).toBe(true)
  })

  it('neighbouring columns sit half a hex apart', () => {
    const a = hexToPixel(find(small, 'C1-1'), 1)
    const b = hexToPixel(find(small, 'C2-1'), 1)
    // C2 is taller (7 vs 4), so its top hex is higher by 1.5 hexes
    expect(((a.y - b.y) / Math.sqrt(3)).toFixed(2)).toBe('1.50')
  })

  it('a ray runs straight to the board edge', () => {
    const top = find(small, 'C6-1')
    const down = ray(small, top, DIRECTIONS[3])
    expect(down).toHaveLength(small.columns[5] - 1)
    expect(sameHex(down[0], find(small, 'C6-2'))).toBe(true)
  })
})
