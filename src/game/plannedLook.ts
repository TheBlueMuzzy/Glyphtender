// Which look a planned (targeted, not yet cast) seed has — see PlannedSeedLook.tsx (B010).
export const PLANNED_LOOKS = ['dimmed', 'greyed', 'misty'] as const
export type PlannedLook = (typeof PLANNED_LOOKS)[number]

/** The look to use: garden.json's choice, or "misty" (the default) if it's mistyped. */
export function plannedLookOf(value: string): PlannedLook {
  return (PLANNED_LOOKS as readonly string[]).includes(value) ? (value as PlannedLook) : 'misty'
}

export const PLANNED_FILTER_ID = 'planned-seed-look'
