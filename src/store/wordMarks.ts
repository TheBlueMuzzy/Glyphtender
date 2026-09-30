// WHAT THE BOARD MARKS ABOUT MADE WORDS (word indicators on) — plain functions, tested:
//   the hexes that get the white word border (WordBorders.tsx).
import { hexKey, type Hex } from '../engine/hex'

/** The same hexes once each (a letter shared by two words gets one border). */
export function uniqueHexes(list: Hex[]): Hex[] {
  const seen = new Map(list.map((h) => [hexKey(h), h]))
  return [...seen.values()]
}
