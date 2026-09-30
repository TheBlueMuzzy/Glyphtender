// IDENTITY — who this player is, remembered in the browser.  (Browser only — the server never imports this.)
//
// Two ids, on purpose (proven in Roll Better):
// - persistentId (localStorage) — the PLAYER. Same in every tab and after closing the browser.
//   It owns the seat: come back with it and you get your seat back.
// - tabId (sessionStorage) — this TAB's connection. Survives a reload, so the server sees the same
//   connection id when a tab reconnects (tidy logs, and a reconnect isn't mistaken for a new tab).
// The player's name is remembered too, so the name box is filled in next time.
//
// Every read and write is wrapped: private windows or blocked storage just get a fresh id for now.

const PERSISTENT_ID_KEY = 'rooms:persistent-id'
const TAB_ID_KEY = 'rooms:tab-id'
const NAME_KEY = 'rooms:player-name'

// Used when the browser won't let us store anything (the ids then last until the page closes)
const fallback = new Map<string, string>()

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return fallback.get(key) ?? null
  }
}

function write(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value)
  } catch {
    fallback.set(key, value)
  }
}

/** A random id: 16 letters and digits (no look-alikes). */
export function makeId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const numbers = new Uint32Array(16)
  crypto.getRandomValues(numbers)
  return Array.from(numbers, (n) => letters[n % letters.length]).join('')
}

function getOrMake(storage: () => Storage, key: string): string {
  const saved = read(storage, key)
  if (saved) return saved
  const id = makeId()
  write(storage, key, id)
  return id
}

/** The player's id — same in every tab, kept for good. It owns their seat. */
export function getPersistentId(): string {
  return getOrMake(() => localStorage, PERSISTENT_ID_KEY)
}

/** This tab's connection id — kept through a reload of this tab. */
export function getTabId(): string {
  return getOrMake(() => sessionStorage, TAB_ID_KEY)
}

/** The name the player used last time ("" the first time). */
export function getPlayerName(): string {
  return read(() => localStorage, NAME_KEY) ?? ''
}

export function setPlayerName(name: string): void {
  write(() => localStorage, NAME_KEY, name)
}
