// ROOM CODES — the short code friends type (or say out loud) to join the same room.
// Used by the game (make a code, check what the player typed) AND by the server (refuse junk codes).
//
// A code is 4 letters that alternate consonant–vowel, like BAKU, MOTE or ZIRA:
// easy to say over voice chat, easy to read on a phone, and it looks a bit like a word.
// - No C, Q, W, X or Y (they sound like other letters or make spelling harder).
// - Typing is forgiving: lowercase, spaces and dashes are fine, and 0 / 1 are read as O / I.
// - 16 × 5 × 16 × 5 = 6,400 codes. If a new code happens to be in use, the server says
//   "code_taken" and the game simply makes another one (see useRoom in README).

export const CONSONANTS = 'BDFGHJKLMNPRSTVZ'
export const VOWELS = 'AEIOU'
export const CODE_LENGTH = 4

// Codes we never hand out (they spell something rude). Typing one still works.
export const NEVER_MAKE = ['DAGO', 'DIKE', 'FUKU', 'HOMO', 'KAKA', 'LOLI', 'NAZI', 'NEGA', 'NIGA', 'PEDO', 'PENE', 'PENI', 'PUTA', 'PUTO', 'RAPE', 'SUKA']

function pick(letters: string, random: () => number): string {
  return letters[Math.floor(random() * letters.length)]
}

/** A fresh room code, e.g. "BAKU". `random` is only passed in by tests. */
export function makeRoomCode(random: () => number = Math.random): string {
  for (;;) {
    const code = pick(CONSONANTS, random) + pick(VOWELS, random) + pick(CONSONANTS, random) + pick(VOWELS, random)
    if (!NEVER_MAKE.includes(code)) return code
  }
}

/** Is this exactly a room code (already cleaned)? */
export function isRoomCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false
  for (let i = 0; i < CODE_LENGTH; i++) {
    const letters = i % 2 === 0 ? CONSONANTS : VOWELS
    if (!letters.includes(code[i])) return false
  }
  return true
}

/** What the player typed → a room code, or null if it can't be one ("ba-ku" → "BAKU"). */
export function cleanRoomCode(typed: string): string | null {
  const code = typed
    .toUpperCase()
    .replaceAll('0', 'O')
    .replaceAll('1', 'I')
    .replace(/[^A-Z]/g, '')
  return isRoomCode(code) ? code : null
}
