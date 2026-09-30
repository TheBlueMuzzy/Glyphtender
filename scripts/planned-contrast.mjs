// HOW LEGIBLE IS THE PLANNED SEED'S LETTER? (B010) — measures the letter-vs-tile contrast of every seed picture
// (public/art/runeblossoms, 26 letters × 4 colours) as a real seed and in each planned look.
// The maths copies PlannedSeedLook.tsx's SVG filters (they work in sRGB). Letter = the brightest 25% of the tile's
// middle, tile = the darkest 40%; contrast = the WCAG ratio (L1 + 0.05) / (L2 + 0.05) of their median luminances.
//   node scripts/planned-contrast.mjs
import { readdirSync } from 'node:fs'
import sharp from 'sharp'
import garden from '../content/tuning/garden.json' with { type: 'json' }

const DIR = 'public/art/runeblossoms'
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b // what the filters' greyscale step uses (sRGB values)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const clamp = (v) => Math.min(1, Math.max(0, v))
// feComponentTransfer type="table": straight lines between evenly spaced values
const table = (values, v) => {
  const n = values.length - 1, k = Math.min(n - 1, Math.floor(v * n))
  return values[k] + (v * n - k) * (values[k + 1] - values[k])
}
const ramp = (stops, v) => [0, 1, 2].map((i) => table(stops.map((s) => s[i]), v))

// Each look: an sRGB pixel [r,g,b] (0–1) of the art → the pixel on screen
const LOOKS = {
  'real seed': (p) => p,
  dimmed: (p) => mix(rgb(garden.hexFill), p, garden.plannedSeedOpacity),
  greyed: (p) => { const y = luma(p); return mix([y, y, y], p, 0.15).map((v) => v * 0.6) },
  misty: (p) => mix(p, rgb(garden.plannedMist), garden.plannedMistStrength),
  moonlit: (p) => ramp([rgb(garden.plannedMoonShadow), rgb(garden.plannedMoonLight)],
    clamp(luma(p) * garden.plannedMoonBrightness)),
  stencil: (p) => {
    const t = clamp((luma(p) - garden.plannedStencilCut) / garden.plannedStencilSoftness + 0.5) // a soft step round the cut
    return mix(rgb(garden.plannedStencilTile), rgb(garden.plannedStencilLetter), t)
  },
}

const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const results = Object.fromEntries(Object.keys(LOOKS).map((k) => [k, []]))
const files = readdirSync(DIR).filter((f) => f.endsWith('.webp'))
for (const file of files) {
  const { data, info } = await sharp(`${DIR}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = []
  const c = info.width / 2, r = info.width * 0.3 // the tile's middle, well inside its coloured border
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4
    if (data[i + 3] < 250 || (x - c) ** 2 + (y - c) ** 2 > r * r) continue
    pixels.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255])
  }
  pixels.sort((a, b) => luminance(a) - luminance(b))
  const tile = pixels.slice(0, Math.floor(pixels.length * 0.4))
  const letter = pixels.slice(Math.floor(pixels.length * 0.75))
  for (const [name, look] of Object.entries(LOOKS)) {
    const L = median(letter.map((p) => luminance(look(p))))
    const T = median(tile.map((p) => luminance(look(p))))
    results[name].push({ file, contrast: ratio(L, T) })
  }
}

console.log(`letter vs tile contrast, ${files.length} seed pictures (WCAG ratio; 4.5 = body text, 3 = large text)`)
for (const [name, rows] of Object.entries(results)) {
  const cs = rows.map((r) => r.contrast)
  const worst = rows.reduce((a, b) => (b.contrast < a.contrast ? b : a))
  const byColour = ['yellow', 'blue', 'pink', 'purple'].map((col) => {
    const xs = rows.filter((r) => r.file.includes(col)).map((r) => r.contrast)
    return `${col} ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)}`
  })
  console.log(`${name.padEnd(10)} median ${median([...cs]).toFixed(1)} · worst ${worst.contrast.toFixed(1)} (${worst.file}) · ${byColour.join(' · ')}`)
}
