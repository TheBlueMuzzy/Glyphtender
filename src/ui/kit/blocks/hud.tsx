// IN GAME — Pause, the HUD frame, and the HUD pieces that go in it.
// HUD pieces never catch taps (the game underneath gets them); only their buttons do.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Panel, Row, Screen, Stack } from '../layout'
import { Avatar, Badge, Button, ProgressBar, Text } from '../controls'
import { screens } from '../screens'
import { askConfirm, Modal } from './dialogs'
import { useCountUp } from './motion'
import { fill } from './words'

// PAUSE — a dialog over the game. Resume closes it; Quit asks first (turn off with confirmQuit={false}).
export const pauseWords = { title: 'Paused', resume: 'Resume', settings: 'Settings', howToPlay: 'How to play', quit: 'Quit', quitTitle: 'Quit this game?', quitMessage: 'Your progress in this round will be lost.' }
type PauseProps = {
  onResume?: () => void; onSettings?: () => void; onHowToPlay?: () => void; onQuit?: () => void
  confirmQuit?: boolean; words?: Partial<typeof pauseWords>
}
export function Pause({ onResume = () => screens.pop(), onSettings, onHowToPlay, onQuit, confirmQuit = true, words }: PauseProps) {
  const w = { ...pauseWords, ...words }
  const quit = () => confirmQuit && onQuit
    ? askConfirm({ title: w.quitTitle, message: w.quitMessage, danger: true, onConfirm: onQuit, words: { yes: w.quit } })
    : onQuit?.()
  return (
    <Modal title={w.title}>
      <Stack gap="s" className="kit-menu">
        <Button onClick={onResume}>{w.resume}</Button>
        {onSettings && <Button variant="secondary" onClick={onSettings}>{w.settings}</Button>}
        {onHowToPlay && <Button variant="secondary" onClick={onHowToPlay}>{w.howToPlay}</Button>}
        {onQuit && <Button variant="danger" onClick={quit}>{w.quit}</Button>}
      </Stack>
    </Modal>
  )
}

// HUD FRAME — the usual places: vitals top-left, pause + money top-right, timer/score/turn
// top-centre, actions along the bottom, banners in the middle. Pass only what your game shows.
export const hudWords = { label: 'Game HUD', pause: 'Pause' }
type HudProps = {
  vitals?: ReactNode; status?: ReactNode; currency?: ReactNode; onPause?: () => void
  actions?: ReactNode; banner?: ReactNode; bottomLeft?: ReactNode; bottomRight?: ReactNode
  words?: Partial<typeof hudWords>
}
export function Hud({ vitals, status, currency, onPause, actions, banner, bottomLeft, bottomRight, words }: HudProps) {
  const w = { ...hudWords, ...words }
  // Each slot's contents sit in kit-hud-slot, which lets taps through to the game (blocks.css)
  const slot = (content: ReactNode) => content && <div className="kit-hud-slot">{content}</div>
  const pause = onPause && <Button variant="secondary" icon aria-label={w.pause} onClick={onPause}>❚❚</Button>
  return (
    <Screen label={w.label} topLeft={slot(vitals)} top={slot(status)}
      topRight={slot((currency || pause) && <Row gap="s">{currency}{pause}</Row>)}
      bottomLeft={slot(bottomLeft)} bottom={slot(actions)} bottomRight={slot(bottomRight)}>
      {slot(banner)}
    </Screen>
  )
}

// A small readable plate behind a HUD piece, so it shows up over any game art.
type ChipProps = { children: ReactNode; active?: boolean; role?: string; 'aria-label'?: string; 'data-width'?: string }
function Chip({ children, active, ...rest }: ChipProps) {
  return <Row gap="s" className="kit-hud-chip" data-state={active ? 'active' : undefined} {...rest}>{children}</Row>
}

// PIPS — a row of little segments, some filled (hearts, lives, page dots, "3 of 5").
export function Pips({ count, filled, label }: { count: number; filled: number; label: string }) {
  return (
    <Row gap="xs" className="kit-pips" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={count} aria-valuenow={filled}>
      {Array.from({ length: count }, (_, i) => <span key={i} className="kit-pip" data-state={i < filled ? 'on' : undefined} />)}
    </Row>
  )
}

// BAR — health, XP, energy… value out of max. pips: draw it as segments (hearts, lives) instead.
// width: how long the bar is — 's' short, 'm' medium, 'l' long. Without it the bar fills the room it's given.
type BarProps = {
  label: string; value: number; max?: number; variant?: 'primary' | 'accent' | 'danger'; pips?: boolean; icon?: ReactNode
  width?: 's' | 'm' | 'l'
}
export function Bar({ label, value, max = 100, variant = 'primary', pips, icon, width }: BarProps) {
  return (
    <Chip data-width={width}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {pips ? <Pips count={max} filled={value} label={label} /> : <ProgressBar label={label} value={value / max} variant={variant} />}
    </Chip>
  )
}

// "+5" that floats up and fades whenever a number changes (red "−3" when it drops).
// Uses the style's motion; with reduce motion on, the number just changes.
function useFloatUps(value: number) {
  const last = useRef(value)
  const nextId = useRef(0)
  const [floats, setFloats] = useState<{ id: number; delta: number }[]>([])
  useEffect(() => {
    const delta = value - last.current
    last.current = value
    if (delta) setFloats((list) => [...list, { id: nextId.current++, delta }])
  }, [value])
  return floats.map((f) => (
    <span key={f.id} className="kit-float-up" data-variant={f.delta < 0 ? 'danger' : undefined} aria-hidden="true"
      onAnimationEnd={() => setFloats((list) => list.filter((other) => other.id !== f.id))}>
      {f.delta > 0 ? `+${f.delta}` : `−${-f.delta}`}
    </span>
  ))
}

// COUNTER — an icon and a number (coins, gems, dice left), with the +N float-up.
export function Counter({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <Chip role="group" aria-label={label}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="kit-float-anchor"><Text kind="label">{value}</Text>{useFloatUps(value)}</span>
    </Chip>
  )
}

// SCORE & COMBO — the score (with float-up), and a "×3" that pops each time the combo grows.
export const scoreWords = { score: 'Score', combo: '×{n}' }
export function Score({ value, combo = 0, words }: { value: number; combo?: number; words?: Partial<typeof scoreWords> }) {
  const w = { ...scoreWords, ...words }
  return (
    <Chip role="group" aria-label={w.score}>
      <Text kind="caption">{w.score}</Text>
      <span className="kit-float-anchor"><Text kind="heading">{value}</Text>{useFloatUps(value)}</span>
      {combo > 1 && <span key={combo} className="kit-combo"><Badge variant="primary">{fill(w.combo, { n: combo })}</Badge></span>}
    </Chip>
  )
}

// TIMER RING — seconds left, drawn as a ring that empties. Turns red at warnAt seconds.
type TimerProps = { seconds: number; total: number; label?: string; warnAt?: number }
export function TimerRing({ seconds, total, label = 'Time left', warnAt = 5 }: TimerProps) {
  const left = Math.max(0, seconds)
  const full = total ? left / total : 0 // how much of the ring is still coloured, 0 to 1
  return (
    <span className="kit-timer" role="timer" aria-label={label} data-variant={left <= warnAt ? 'danger' : undefined}
      style={{ '--kit-fill': full } as CSSProperties}>
      <Text kind="label">{Math.ceil(left)}</Text>
    </span>
  )
}

// HUD TEXT — plain words straight on the game: "Hold to Roll", "Locked 1!", "Round 1".
// No plate, outline or shadow block (only buttons look like buttons): the style's on-game colour
// with a soft shade behind it so it reads over any art. Read out politely when it changes, and it
// pops in again whenever the text changes.  size: s | m (default) | l.  tone: accent = highlighted.
// pop: when the text changes, a quick grow-and-settle instead of the soft entrance — to call attention
// to a change ("Round 2"). Off with reduce motion, like every animation.
type HudTextProps = { children: string; detail?: string; size?: 's' | 'm' | 'l'; tone?: 'normal' | 'accent'; pop?: boolean }
export function HudText({ children, detail, size = 'm', tone = 'normal', pop }: HudTextProps) {
  const kind = size === 's' ? 'label' : size === 'm' ? 'heading' : 'title'
  return (
    <div className="kit-hud-text" data-size={size} data-tone={tone === 'accent' ? tone : undefined} data-pop={pop || undefined} aria-live="polite">
      <Stack key={children} gap="xs">
        <Text kind={kind}>{children}</Text>
        {detail && <Text kind="label">{detail}</Text>}
      </Stack>
    </div>
  )
}

// TURN BANNER — "Sam's turn" / "Level 2!" in the middle. It pops in again whenever the text changes.
// variant="plain": big HudText instead of a panel (for instructions that must not look like a button).
export function TurnBanner({ text, detail, variant = 'panel' }: { text: string; detail?: string; variant?: 'panel' | 'plain' }) {
  if (variant === 'plain') return <HudText size="l" detail={detail}>{text}</HudText>
  return (
    <Panel key={text} depth={2} gap="xs" className="kit-banner" role="status">
      <Text kind="title">{text}</Text>
      {detail && <Text kind="caption">{detail}</Text>}
    </Panel>
  )
}

// PLAYER SEATS — everyone at the table; whoever's turn it is gets the highlight.
export type Seat = { id: string; name: string; avatar?: string; score?: ReactNode }
export function PlayerSeats({ players, activeId }: { players: Seat[]; activeId?: string }) {
  return (
    <Row gap="s">
      {players.map((p) => (
        <Chip key={p.id} active={p.id === activeId}>
          <Avatar name={p.name} src={p.avatar} active={p.id === activeId} />
          <Stack gap="xs">
            <Text kind="label">{p.name}</Text>
            {p.score !== undefined && <Text kind="caption">{p.score}</Text>}
          </Stack>
        </Chip>
      ))}
    </Row>
  )
}

// PLAYER CHIP — one player's little card, to sit beside their row or seat in the game (the game
// places it). Avatar (or an icon, or nothing), name, score with its icon, a detail line, a badge.
//   active: highlighted (whose turn it is, or you).   dim: faded (e.g. while something passes over it).
//   size: 'm' (default), 's' for tight spots, 'xs' for the tightest (rows close together, e.g. a phone on its
//         side): ONE line — name, badge and detail side by side — with a smaller avatar.
//   showName={false}: the name is only read out.
//   avatar: a picture; avatar={false} hides it — with icon, that makes a goal/target chip.
// The score counts up when it rises (and floats up "+N" — floatUps={false} when the game already flies the points
// in itself); with reduce motion on it just changes.
// Like every HUD piece it never catches taps: the game underneath gets them.
export const playerChipWords = { score: '{n} points' }
export type PlayerChipProps = {
  name: string; showName?: boolean; color?: string; avatar?: string | false; icon?: ReactNode
  score?: number; scoreIcon?: ReactNode; detail?: ReactNode; badge?: ReactNode
  active?: boolean; dim?: boolean; size?: 'xs' | 's' | 'm'; floatUps?: boolean; words?: Partial<typeof playerChipWords>
}
export function PlayerChip({
  name, showName = true, color, avatar, icon, score, scoreIcon = '★', detail, badge,
  active, dim, size = 'm', floatUps = true, words,
}: PlayerChipProps) {
  const w = { ...playerChipWords, ...words }
  const shownScore = useCountUp(score ?? 0)
  const floats = useFloatUps(score ?? 0)
  const oneLine = size === 'xs' // the detail sits beside the name and badge instead of on a line below
  const hasNameLine = showName || badge || (oneLine && detail)
  return (
    <Row gap={size === 'm' ? 's' : 'xs'} className="kit-hud-chip kit-player-chip kit-nowrap" role="group" aria-label={name}
      data-state={active ? 'active' : undefined} data-dim={dim || undefined} data-size={size}>
      {icon && <span className="kit-player-chip-icon" aria-hidden="true">{icon}</span>}
      {!icon && avatar !== false && <Avatar name={name} src={avatar || undefined} color={color} active={active} />}
      {(showName || detail || badge) && (
        <Stack gap="xs" className="kit-player-chip-text">
          {hasNameLine && (
            <Row gap="xs" className="kit-nowrap">
              {showName && <Text kind="label">{name}</Text>}
              {badge && <Badge>{badge}</Badge>}
              {oneLine && detail && <Text kind="caption">{detail}</Text>}
            </Row>
          )}
          {!oneLine && detail && <Text kind="caption">{detail}</Text>}
        </Stack>
      )}
      {score !== undefined && (
        <span className="kit-player-chip-score" role="img" aria-label={fill(w.score, { n: score })}>
          <span className="kit-player-chip-star" aria-hidden="true">{scoreIcon}</span>
          <span className="kit-float-anchor" aria-hidden="true">
            <Text kind={size === 'm' ? 'heading' : 'label'}>{shownScore}</Text>{floatUps && floats}
          </span>
        </span>
      )}
    </Row>
  )
}

// RANK — "2nd" (of 8). format turns a place into words; the default is English.
const englishSuffix: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' }
const ordinalRule = new Intl.PluralRules('en', { type: 'ordinal' })
export const ordinal = (place: number) => place + englishSuffix[ordinalRule.select(place)]
type RankProps = { place: number; of?: number; format?: (place: number) => string; label?: string }
export function Rank({ place, of, format = ordinal, label = 'Place' }: RankProps) {
  return (
    <Chip role="group" aria-label={label}>
      <span className="kit-place"><Text kind="heading">{format(place)}</Text></span>
      {of !== undefined && <Text kind="caption">/ {of}</Text>}
    </Chip>
  )
}

// CONNECTION DOT — online status. Says it in words too when something's wrong.
export const connectionWords = { good: 'Connected', weak: 'Weak connection', lost: 'Offline' }
export function ConnectionDot({ status, words }: { status: 'good' | 'weak' | 'lost'; words?: Partial<typeof connectionWords> }) {
  const w = { ...connectionWords, ...words }
  return (
    <Chip role="status" aria-label={w[status]}>
      <span className="kit-dot" data-status={status} />
      {status !== 'good' && <Text kind="caption">{w[status]}</Text>}
    </Chip>
  )
}
