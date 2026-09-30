// CHECKS — for a game's checkAction / checkOptions: is what a player sent really the right shape?  (Server.)
// Never trust a message from a browser: a modified client can send anything. Each helper returns
// the value when it's fine and throws an Error with a plain reason when it isn't
// (RoomServer turns that into a "bad_action" reply — the room carries on).
//
//   checkAction(raw) {
//     const action = mustBeObject(raw, 'action')
//     const type = mustBeOneOf(action.type, ['draft', 'turn', 'refresh'], 'action type')
//     const slots = mustBeList(action.slots, 8, (slot) => mustBeWholeNumber(slot, 0, 7, 'slot'), 'slots')
//     ...
//   }

export function mustBeObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} must be an object`)
  return value as Record<string, unknown>
}

export function mustBeOneOf<T extends string>(value: unknown, allowed: readonly T[], what: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${what} must be one of: ${allowed.join(', ')}`)
  return value as T
}

/** A whole number from min to max (both included). */
export function mustBeWholeNumber(value: unknown, min: number, max: number, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${what} must be a whole number from ${min} to ${max}`)
  }
  return value
}

export function mustBeText(value: unknown, maxLength: number, what: string): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${what} must be text (at most ${maxLength} characters)`)
  return value
}

export function mustBeTrueOrFalse(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${what} must be true or false`)
  return value
}

/** A list of at most maxLength items, each checked by checkItem. */
export function mustBeList<T>(value: unknown, maxLength: number, checkItem: (item: unknown, index: number) => T, what: string): T[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new Error(`${what} must be a list of at most ${maxLength}`)
  return value.map((item, index) => checkItem(item, index))
}

/** Like mustBeList, but no item may appear twice (Roll Better: duplicate unlock slots). */
export function mustBeListWithoutRepeats<T>(value: unknown, maxLength: number, checkItem: (item: unknown, index: number) => T, what: string): T[] {
  const list = mustBeList(value, maxLength, checkItem, what)
  if (new Set(list).size !== list.length) throw new Error(`${what} has the same item twice`)
  return list
}

/** null stays null; anything else must pass `check`. */
export function nullOr<T>(value: unknown, check: (value: unknown) => T): T | null {
  return value === null ? null : check(value)
}
