// The cast options' colour: a LIGHTER or DARKER version of the player's colour (Muzzy 2026-10-01: "The dotted outline
// to indicate casting locations template is very distracting. let's just do a darker or lighter version of the
// movement template coloring"). garden.json castShade: + = towards white (lighter), − = towards the night (darker).
// Plain maths, tested in castShade.test.ts.

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/** `colour` moved `amount` (0–1) of the way to `towards` — both "#rrggbb"; towards 'white' = full light. */
export function mixColour(colour: string, towards: string, amount: number): string {
  const a = channels(colour), b = towards === 'white' ? [255, 255, 255] : channels(towards)
  return toHex(a.map((c, i) => c + (b[i] - c) * amount))
}

/** The cast colour for a player: shade > 0 lightens towards white, shade < 0 darkens towards `night`. */
export const castColour = (player: string, night: string, shade: number): string =>
  shade >= 0 ? mixColour(player, 'white', shade) : mixColour(player, night, -shade)
