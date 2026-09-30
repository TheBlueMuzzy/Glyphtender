// THE PLANNED SEED'S LOOK (B010) — a targeted seed that isn't cast yet must read "planned, not planted",
// stay SOLID (nothing on the board — hex lines, the gold glow, a word's white border — may show through it)
// and keep its letter easy to read. Each look is an SVG filter drawn only inside the seed art's own shape.
// Legibility = the letter being much BRIGHTER than its tile; the two best looks keep that brightness gap and
// change the colour instead (research: .planning/research/ghost-pieces.md · measure: node scripts/planned-contrast.mjs).
// Pick one in garden.json → plannedSeedLook:
//   moonlit — the default: the seed turned colourless, moonlight-silver (bright parts → plannedMoonLight,
//             dark parts → plannedMoonShadow, plannedMoonBrightness lifts the letter) — a ghost of the seed
//   stencil — a flat cut-out: the letter and border in plannedStencilLetter on a plain plannedStencilTile tile
//   misty   — the art under a soft pale wash (plannedMist, plannedMistStrength) — the letter is hard to read
//   greyed  — the art mostly grey and darker
//   dimmed  — the art faded (plannedSeedOpacity) over an opaque patch of the garden's hex colour
// The pulsing halo in the player's colour (Board.tsx) is drawn on top whatever the look.
import { brightnessMatrix, channels, PLANNED_FILTER_ID, plannedLookOf } from './plannedLook'
import type { GardenTuning } from './useTuning'

/** Paints brightness 0 → `dark`, brightness 1 → `light`, a smooth blend between (a "gradient map"). */
function Ramp({ dark, light }: { dark: string; light: string }) {
  const [d, l] = [channels(dark), channels(light)]
  return (
    <feComponentTransfer>
      <feFuncR type="table" tableValues={`${d[0]} ${l[0]}`} />
      <feFuncG type="table" tableValues={`${d[1]} ${l[1]}`} />
      <feFuncB type="table" tableValues={`${d[2]} ${l[2]}`} />
    </feComponentTransfer>
  )
}

/** The filter (goes in the board's <defs>). */
export function PlannedSeedFilter({ colours }: { colours: GardenTuning }) {
  const look = plannedLookOf(colours.plannedSeedLook)
  // stencil: brightness below the cut → tile, above → letter, blended over plannedStencilSoftness
  const soft = colours.plannedStencilSoftness
  return (
    <filter id={PLANNED_FILTER_ID} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
      {look === 'moonlit' && <>
        <feColorMatrix in="SourceGraphic" type="matrix" values={brightnessMatrix(colours.plannedMoonBrightness)} />
        <Ramp dark={colours.plannedMoonShadow} light={colours.plannedMoonLight} />
      </>}
      {look === 'stencil' && <>
        <feColorMatrix in="SourceGraphic" type="matrix" values={brightnessMatrix(1)} />
        <feComponentTransfer>
          <feFuncR type="linear" slope={1 / soft} intercept={0.5 - colours.plannedStencilCut / soft} />
          <feFuncG type="linear" slope={1 / soft} intercept={0.5 - colours.plannedStencilCut / soft} />
          <feFuncB type="linear" slope={1 / soft} intercept={0.5 - colours.plannedStencilCut / soft} />
        </feComponentTransfer>
        <Ramp dark={colours.plannedStencilTile} light={colours.plannedStencilLetter} />
      </>}
      {look === 'dimmed' && <>
        {/* the art's shape, fully solid (its soft edges stay soft), in the hex colour */}
        <feComponentTransfer in="SourceAlpha" result="shape">
          <feFuncA type="linear" slope={4} />
        </feComponentTransfer>
        <feFlood floodColor={colours.hexFill} />
        <feComposite in2="shape" operator="in" result="patch" />
        <feComponentTransfer in="SourceGraphic" result="faded">
          <feFuncA type="linear" slope={colours.plannedSeedOpacity} />
        </feComponentTransfer>
        <feMerge><feMergeNode in="patch" /><feMergeNode in="faded" /></feMerge>
      </>}
      {look === 'greyed' && <>
        <feColorMatrix in="SourceGraphic" type="saturate" values="0.15" />
        <feComponentTransfer>
          <feFuncR type="linear" slope={0.6} />
          <feFuncG type="linear" slope={0.6} />
          <feFuncB type="linear" slope={0.6} />
        </feComponentTransfer>
      </>}
      {look === 'misty' && <>
        <feFlood floodColor={colours.plannedMist} floodOpacity={colours.plannedMistStrength} />
        <feComposite in2="SourceGraphic" operator="in" result="wash" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="wash" /></feMerge>
      </>}
    </filter>
  )
}
