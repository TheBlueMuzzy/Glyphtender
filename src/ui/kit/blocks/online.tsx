// ONLINE — Lobby (create a room, or join one by its code; then who's in and who's ready)
// and Reconnecting (lost connection / can't connect). The game does the networking and
// passes in what's true right now; these screens only show it and report button presses.
// Optional: onBack (a Back button on the create / join card), onReady (leave it out for games
// that mark players ready by themselves: no Ready button, and Start doesn't wait for it).
import { useRef, useState } from 'react'
import { Panel, Row, Screen, Stack } from '../layout'
import { Avatar, Badge, Button, ListRow, RoomCodeInput, ScrollArea, Text, TextInput } from '../controls'
import { Modal, Spinner, toast } from './dialogs'
import { fill } from './words'

export const lobbyWords = {
  title: 'Play online', create: 'Create a room', or: 'or join a friend', join: 'Join', name: 'Your name',
  room: 'Room {code}', share: 'Share this code with your friends', host: 'Host', ready: 'Ready', notReady: 'Not ready',
  imReady: 'I’m ready', notYet: 'Not ready yet', start: 'Start game', leave: 'Leave', back: 'Back',
  copy: 'Copy', copied: 'Code copied!',
  waitingHost: 'Waiting for the host to start…', needPlayers: 'Need at least {n} players', waitingReady: 'Waiting for everyone to be ready',
}
export type LobbyPlayer = { id: string; name: string; ready?: boolean; avatar?: string; color?: string }
type LobbyProps = {
  roomCode?: string // no code yet → the create / join screen; a code → the room
  players?: LobbyPlayer[]; meId?: string; hostId?: string; minPlayers?: number; codeLength?: number
  busy?: boolean; error?: string // busy: creating or joining right now; error: why it didn't work
  name?: string; onNameChange?: (name: string) => void // shows a name box when given
  onCreate: () => void; onJoin: (code: string) => void
  onReady?: (ready: boolean) => void // leave out when the game marks players ready itself
  onStart: () => void; onLeave: () => void
  onBack?: () => void // shows a Back button on the create / join card
  words?: Partial<typeof lobbyWords>
}

export function Lobby(props: LobbyProps) {
  const w = { ...lobbyWords, ...props.words }
  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-modal">
        {props.roomCode ? <Room {...props} w={w} roomCode={props.roomCode} /> : <JoinOrCreate {...props} w={w} />}
      </Panel>
    </Screen>
  )
}

function JoinOrCreate({ w, busy, error, name, onNameChange, onCreate, onJoin, onBack, codeLength = 4 }: LobbyProps & { w: typeof lobbyWords }) {
  const [code, setCode] = useState('')
  return (
    <>
      <Text kind="title">{w.title}</Text>
      {/* Scrolls on short screens (landscape phones), so Back and the error below always show */}
      <ScrollArea label={w.title}>
        <Stack gap="m">
          {onNameChange && <TextInput label={w.name} value={name ?? ''} onChange={(e) => onNameChange(e.target.value)} />}
          <Button loading={busy} onClick={onCreate}>{w.create}</Button>
          <Text kind="caption">{w.or}</Text>
          <Row gap="s">
            <RoomCodeInput length={codeLength} value={code} onChange={setCode} />
            <Button variant="secondary" disabled={busy || code.length < codeLength} onClick={() => onJoin(code)}>{w.join}</Button>
          </Row>
        </Stack>
      </ScrollArea>
      {error && <Text kind="caption"><span className="kit-error">{error}</span></Text>}
      {onBack && <Row gap="s"><Button variant="ghost" onClick={onBack}>{w.back}</Button></Row>}
    </>
  )
}

// Copies text to the clipboard. Where the Clipboard API is missing or refuses (old browsers,
// a page that isn't https), it selects the text on screen instead, so the player can copy it
// by hand. Never throws. Returns true when the text really was copied.
export async function copyText(text: string, shown?: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // refused: fall through to selecting the text
  }
  try {
    if (!shown) return false
    const range = document.createRange()
    range.selectNodeContents(shown)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return typeof document.execCommand === 'function' && document.execCommand('copy') // the old way; often still works
  } catch {
    return false
  }
}

function Room({ w, roomCode, players = [], meId, hostId, minPlayers = 2, onReady, onStart, onLeave }: LobbyProps & { w: typeof lobbyWords; roomCode: string }) {
  const codeBox = useRef<HTMLSpanElement>(null)
  const me = players.find((p) => p.id === meId)
  const iAmHost = meId !== undefined && meId === hostId
  const enough = players.length >= minPlayers
  // The host starts, so needn't press Ready. No onReady: the game handles ready itself, so nobody waits for it.
  const allReady = !onReady || players.every((p) => p.ready || p.id === hostId)
  const [beforeCode, afterCode = ''] = w.room.split('{code}') // "Room {code}" → the code gets its own box to select
  const copy = async () => { if (await copyText(roomCode, codeBox.current)) toast(w.copied) }
  const waiting = !enough ? fill(w.needPlayers, { n: minPlayers }) : !allReady ? w.waitingReady : !iAmHost ? w.waitingHost : ''
  return (
    <>
      <Row gap="s" className="kit-nowrap">
        <Stack gap="xs" className="kit-result-name">
          <Text kind="title">{beforeCode}<span ref={codeBox}>{roomCode}</span>{afterCode}</Text>
          <Text kind="caption">{w.share}</Text>
        </Stack>
        <Button variant="secondary" onClick={copy}>{w.copy}</Button>
      </Row>
      <ScrollArea label={w.title} max="m">
        {players.map((p) => (
          <ListRow key={p.id} label={
            <Row gap="s" className="kit-nowrap">
              <Avatar name={p.name} src={p.avatar} color={p.color} active={p.id === meId} />
              <Row gap="xs" className="kit-result-name"><Text kind="label">{p.name}</Text>{p.id === hostId && <Badge>{w.host}</Badge>}</Row>
            </Row>
          }>
            {onReady && p.id !== hostId && <Badge variant={p.ready ? 'primary' : 'neutral'}>{p.ready ? `✓ ${w.ready}` : w.notReady}</Badge>}
          </ListRow>
        ))}
      </ScrollArea>
      {waiting && <Text kind="caption">{waiting}</Text>}
      <Row gap="s" justify="between">
        <Button variant="ghost" onClick={onLeave}>{w.leave}</Button>
        {iAmHost
          ? <Button disabled={!enough || !allReady} onClick={onStart}>{w.start}</Button>
          : onReady && <Button variant={me?.ready ? 'secondary' : 'primary'} onClick={() => onReady(!me?.ready)}>{me?.ready ? w.notYet : w.imReady}</Button>}
      </Row>
    </>
  )
}

// RECONNECTING — a dialog while the connection comes back; with failed, an error and what to do.
export const reconnectWords = {
  title: 'Reconnecting…', message: 'Hold on, getting you back into the game.',
  failedTitle: 'Can’t connect', failedMessage: 'Check your internet connection and try again.', retry: 'Try again', quit: 'Quit',
}
type ReconnectProps = { failed?: boolean; message?: string; onRetry?: () => void; onQuit?: () => void; words?: Partial<typeof reconnectWords> }
export function Reconnecting({ failed, message, onRetry, onQuit, words }: ReconnectProps) {
  const w = { ...reconnectWords, ...words }
  return (
    <Modal title={failed ? w.failedTitle : w.title} actions={<>
      {onQuit && <Button variant="secondary" onClick={onQuit}>{w.quit}</Button>}
      {failed && onRetry && <Button onClick={onRetry}>{w.retry}</Button>}
    </>}>
      <Row gap="m" className="kit-nowrap">
        {!failed && <Spinner label={w.title} />}
        <Text>{message ?? (failed ? w.failedMessage : w.message)}</Text>
      </Row>
    </Modal>
  )
}

// SEAT PICKER — join a game that's already going: pick a seat (often a bot's) to take over.
// The game says which seats are free; this screen shows them and reports the pick.
// After a pick the game passes waiting (spinner + Cancel) until it's in, or an error if it didn't work.
// onCancel is both buttons: Leave (not waiting) and Cancel (waiting) — the game knows which by its own waiting flag.
export const seatPickerWords = {
  title: 'Game in progress', caption: 'Pick a seat to take over', seats: 'Seats',
  empty: 'No seats available right now', joining: 'Joining…', cancel: 'Cancel', leave: 'Leave',
}
export type PickableSeat = { id: string; name: string; color?: string; badge?: string; detail?: string } // detail: e.g. "Score 12 · Locks 5/8"
type SeatPickerProps = {
  seats: PickableSeat[]; onPick: (id: string) => void; onCancel: () => void
  waiting?: boolean; error?: string; words?: Partial<typeof seatPickerWords>
}

export function SeatPicker({ seats, onPick, onCancel, waiting, error, words }: SeatPickerProps) {
  const w = { ...seatPickerWords, ...words }
  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-modal">
        <Stack gap="xs">
          <Text kind="title">{w.title}</Text>
          {!waiting && seats.length > 0 && <Text kind="caption">{w.caption}</Text>}
        </Stack>
        {error && <Text kind="caption"><span className="kit-error">{error}</span></Text>}
        {waiting ? (
          <Row gap="m" className="kit-nowrap">
            <Spinner label={w.joining} />
            <Text>{w.joining}</Text>
          </Row>
        ) : seats.length === 0 ? (
          <Text>{w.empty}</Text>
        ) : (
          <ScrollArea label={w.seats} max="m">
            {seats.map((seat) => (
              <ListRow key={seat.id} onClick={() => onPick(seat.id)} label={
                <Row gap="s" className="kit-nowrap">
                  <Avatar name={seat.name} color={seat.color} />
                  <Stack gap="xs" className="kit-result-name">
                    <Row gap="xs"><Text kind="label">{seat.name}</Text>{seat.badge && <Badge>{seat.badge}</Badge>}</Row>
                    {seat.detail && <Text kind="caption">{seat.detail}</Text>}
                  </Stack>
                  <Text kind="label">›</Text>
                </Row>
              } />
            ))}
          </ScrollArea>
        )}
        <Row gap="s" justify="end">
          <Button variant={waiting ? 'secondary' : 'ghost'} onClick={onCancel}>{waiting ? w.cancel : w.leave}</Button>
        </Row>
      </Panel>
    </Screen>
  )
}
