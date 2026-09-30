// Which look a planned (targeted, not yet cast) seed has — see PlannedSeedLook.tsx (B010).
export const PLANNED_LOOKS = ['moonlit', 'stencil', 'misty', 'greyed', 'dimmed'] as const
export type PlannedLook = (typeof PLANNED_LOOKS)[number]

/** The look to use: garden.json's choice, or "moonlit" (the default) if it's mistyped. */
export function plannedLookOf(value: string): PlannedLook {
  return (PLANNED_LOOKS as readonly string[]).includes(value) ? (value as PlannedLook) : 'moonlit'
}

export const PLANNED_FILTER_ID = 'planned-seed-look'

/** "#dce8ff" → its red, green and blue as 0–1 (what an SVG filter table wants). */
export function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** An feColorMatrix that turns every pixel into its brightness (luma), times `boost` — letter bright, tile dark. */
export function brightnessMatrix(boost: number): string {
  const row = [0.2126, 0.7152, 0.0722].map((w) => +(w * boost).toFixed(4)).join(' ') + ' 0 0'
  return [row, row, row, '0 0 0 1 0'].join('  ')
}
