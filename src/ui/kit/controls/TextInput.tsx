// TEXT INPUT — a labelled box for typing (player name, chat).
// ROOM CODE INPUT — N boxes, one letter each: jumps to the next box as you type,
// Backspace goes back, and pasting a whole code fills every box. Emptying a box any other way
// (Delete, cut, a phone keyboard) takes its letter out too.
import { useRef, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react'

export function TextInput({ label, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="kit-field">
      <span className="kit-field-label">{label}</span>
      <input className={`kit-input kit-target ${className}`} {...rest} />
    </label>
  )
}

type RoomCodeProps = { length?: number; value: string; onChange: (code: string) => void; label?: string }

const cleanCode = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '')
// A box that already had a letter now holds old + new; keep only what was just typed.
const newLetters = (boxText: string, oldLetter = '') => (boxText.length > 1 ? boxText.replace(oldLetter, '') : boxText)

export function RoomCodeInput({ length = 4, value, onChange, label = 'Room code' }: RoomCodeProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const focusBox = (i: number) => boxes.current[Math.min(i, length - 1)]?.focus()

  // Put typed or pasted letters in, starting at box i. Never leaves gaps:
  // typing in a box past the end of the code adds to the end instead.
  function write(i: number, text: string) {
    const letters = cleanCode(text)
    const start = Math.min(i, value.length)
    onChange((value.slice(0, start) + letters + value.slice(start + letters.length)).slice(0, length))
    focusBox(start + letters.length)
  }

  // Take the letter in box i out; the letters after it move up, so there's never a gap.
  function remove(i: number) {
    onChange(value.slice(0, i) + value.slice(i + 1))
    focusBox(i)
  }

  // What the box holds now decides: empty → its letter is gone; otherwise → the new letters go in.
  // (Based on the box's text, not on which key was pressed: phone keyboards often don't say.)
  function onBoxChange(i: number, boxText: string) {
    if (boxText === '') remove(i)
    else write(i, newLetters(boxText, value[i]))
  }

  // Backspace in an already-empty box changes nothing in it, so it's handled here: delete the one before.
  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace' || value[i] || i === 0) return
    e.preventDefault()
    remove(i - 1)
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    write(i, e.clipboardData.getData('text'))
  }

  return (
    <div className="kit-roomcode" role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { boxes.current[i] = el }}
          className="kit-input kit-roomcode-box kit-target"
          aria-label={`${label} letter ${i + 1} of ${length}`}
          value={value[i] ?? ''}
          autoCapitalize="characters" autoComplete="off" spellCheck={false}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onBoxChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
        />
      ))}
    </div>
  )
}
