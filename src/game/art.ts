// Where the stand-in art lives (public/art/) — one runeblossom per letter and colour, one portrait per glyphling colour.
import { SEAT_COLOURS, type SeatColour } from '../engine/types'

/** Seat 0 → "yellow", 1 → "blue" … */
export const colourOf = (seat: number): SeatColour => SEAT_COLOURS[seat]

/** The runeblossom picture for a seed, e.g. "Q" → q-blue.webp (the q picture is a plain Q). */
export const seedArt = (letter: string, seat: number) =>
  `${import.meta.env.BASE_URL}art/runeblossoms/${letter.toLowerCase()}-${colourOf(seat)}.webp`

/** A glyphling's portrait. */
export const glyphlingArt = (seat: number) => `${import.meta.env.BASE_URL}art/glyphlings/${colourOf(seat)}.webp`

/** The official word list file. */
export const wordListUrl = () => `${import.meta.env.BASE_URL}words/words.csv`
