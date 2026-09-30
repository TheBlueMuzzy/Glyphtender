// THE PLANNED SEED'S LOOK (B010) — a targeted seed that isn't cast yet must read "planned, not planted",
// but stay SOLID: nothing on the board (hex lines, the gold glow, a word's white border) may show through it.
// Each look is an SVG filter drawn only inside the seed art's own shape. Pick one in garden.json → plannedSeedLook:
//   dimmed — the art faded (plannedSeedOpacity) over an opaque patch of the garden's hex colour
//   greyed — the art at full strength, but mostly grey and darker
//   misty  — the art at full strength under a soft pale wash (plannedMist, plannedMistStrength) — the default
// The pulsing halo in the player's colour (Board.tsx) is drawn on top whatever the look.
import { PLANNED_FILTER_ID, plannedLookOf } from './plannedLook'
import type { GardenTuning } from './useTuning'

/** The filter (goes in the board's <defs>). */
export function PlannedSeedFilter({ colours }: { colours: GardenTuning }) {
  const look = plannedLookOf(colours.plannedSeedLook)
  return (
    <filter id={PLANNED_FILTER_ID} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
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
