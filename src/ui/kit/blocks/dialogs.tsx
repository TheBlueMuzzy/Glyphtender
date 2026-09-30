// DIALOGS & FEEDBACK — Modal, Confirm, Toasts, Tooltip, RewardPopup, EmptyState, Spinner.
// Modal, Confirm and RewardPopup are screens: open them through the screen stack, so Esc,
// phone Back and "only the top screen takes taps" all work. Toasts and tooltips use the
// browser's own popover, so they float above everything without any positioning code.
// (The popover attributes go in as {...{ popover: 'auto' }} spreads: React 18's TypeScript types
// don't list them yet, React 19's do, and both versions put them on the page the same way.)
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Grid, Panel, Row, Screen, Stack } from '../layout'
import { Button, Card, Text } from '../controls'
import { screens } from '../screens'

// MODAL — a dialog box on top of whatever is open. actions = its buttons (bottom right).
type ModalProps = { title: string; children?: ReactNode; actions?: ReactNode }
export function Modal({ title, children, actions }: ModalProps) {
  return (
    <Screen dialog label={title}>
      <Panel depth={2} gap="m" className="kit-modal">
        <Text kind="title">{title}</Text>
        {children}
        {actions && <Row gap="s" justify="end">{actions}</Row>}
      </Panel>
    </Screen>
  )
}

// CONFIRM — "Are you sure?". danger paints the yes-button red (reset progress, quit, delete).
// Either button closes it first, then calls your function. Closing it any other way (Esc, phone
// Back, tapping the dim) counts as Cancel. onCancel runs once at most, and never after onConfirm.
export const confirmWords = { yes: 'OK', no: 'Cancel' }
export type ConfirmProps = {
  title: string; message?: string; danger?: boolean
  onConfirm: () => void; onCancel?: () => void; words?: Partial<typeof confirmWords>
}
export function Confirm({ title, message, danger, onConfirm, onCancel, words }: ConfirmProps) {
  const w = { ...confirmWords, ...words }
  const answered = useRef(false) // true once Yes or Cancel has run
  const close = (then?: () => void) => { answered.current = true; screens.pop(); then?.() }

  // Closed without an answer → that's a Cancel. Checked a moment after closing, because React's
  // StrictMode (while developing) closes and reopens every screen once, which isn't a real close.
  const isOpen = useRef(false)
  useEffect(() => {
    isOpen.current = true
    return () => {
      isOpen.current = false
      queueMicrotask(() => {
        if (isOpen.current || answered.current) return
        answered.current = true
        onCancel?.()
      })
    }
  }, [onCancel])
  return (
    <Modal title={title} actions={<>
      <Button variant="secondary" onClick={() => close(onCancel)}>{w.no}</Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(onConfirm)}>{w.yes}</Button>
    </>}>
      {message && <Text>{message}</Text>}
    </Modal>
  )
}

// askConfirm({ title, onConfirm }) opens a Confirm from anywhere (Settings and Pause use it).
// It needs the kit's own screens in your stack, once:  <ScreenStack screens={{ ...kitScreens, … }}>
let pendingConfirm: ConfirmProps | null = null
export function askConfirm(props: ConfirmProps) {
  pendingConfirm = props
  screens.push('confirm')
}
export const kitScreens = { confirm: () => (pendingConfirm ? <Confirm {...pendingConfirm} /> : null) }

// TOASTS — short messages that fade away ("Saved", "Sam joined"). Call toast('Saved') from
// anywhere; put <ToastStack /> once near the top of your app (outside the ScreenStack).
// dismissible: tapping the toast (or its ✕ Close button) hides it early.
// <ToastStack place="bottom" />: where they show — 'top' (default), 'center' or 'bottom' of the screen
// (of the game picture, in a letterboxed game that sets --kit-frame-w / --kit-frame-h).
export type Toast = { id: number; text: string; variant: 'neutral' | 'danger'; dismissible: boolean }
export const MAX_TOASTS = 3 // older ones make room for new ones
let toastList: readonly Toast[] = []
let nextToastId = 1
const toastListeners = new Set<() => void>()
const setToasts = (next: readonly Toast[]) => { toastList = next; toastListeners.forEach((l) => l()) }

export const toasts = {
  get current() { return toastList },
  subscribe(listener: () => void) { toastListeners.add(listener); return () => { toastListeners.delete(listener) } },
  dismiss(id: number) { setToasts(toastList.filter((t) => t.id !== id)) },
}
type ToastOptions = { variant?: Toast['variant']; seconds?: number; dismissible?: boolean }
export function toast(text: string, { variant = 'neutral', seconds = 3, dismissible = false }: ToastOptions = {}) {
  const id = nextToastId++
  setToasts([...toastList, { id, text, variant, dismissible }].slice(-MAX_TOASTS))
  setTimeout(() => toasts.dismiss(id), seconds * 1000)
  return id
}

export const toastWords = { label: 'Messages', close: 'Close' }
export type ToastPlace = 'top' | 'center' | 'bottom'
export function ToastStack({ label, place = 'top', words }: { label?: string; place?: ToastPlace; words?: Partial<typeof toastWords> }) {
  const w = { ...toastWords, ...words }
  const list = useSyncExternalStore(toasts.subscribe, () => toasts.current, () => toasts.current)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { // show the popover only while there's something to say
    const el = box.current
    if (!el?.showPopover) return // very old browsers: toasts just sit in the page
    const open = el.matches(':popover-open')
    if (list.length && !open) el.showPopover()
    if (!list.length && open) el.hidePopover()
  }, [list.length])
  return (
    <div ref={box} {...{ popover: 'manual' }} className="kit-toasts" data-place={place} role="status" aria-label={label ?? w.label}>
      {list.map((t) => t.dismissible ? (
        <Panel key={t.id} depth={2} gap="s" className="kit-toast" data-variant={t.variant} data-dismissible
          onClick={() => toasts.dismiss(t.id)}>
          <span>{t.text}</span>
          <Button variant="ghost" icon aria-label={w.close}>✕</Button>
        </Panel>
      ) : (
        <Panel key={t.id} depth={2} gap="xs" className="kit-toast" data-variant={t.variant}>{t.text}</Panel>
      ))}
    </div>
  )
}

// TOOLTIP — a small ⓘ button; tap or click it to show a hint next to it (tap anywhere to hide).
export function Tooltip({ text, label = 'More info', icon = 'ⓘ' }: { text: ReactNode; label?: string; icon?: ReactNode }) {
  const id = useId()
  return (
    <>
      <Button variant="ghost" icon aria-label={label} {...{ popoverTarget: id }} className="kit-tooltip-button">{icon}</Button>
      <Panel id={id} {...{ popover: 'auto' }} role="tooltip" depth={2} gap="xs" className="kit-tooltip">{text}</Panel>
    </>
  )
}

// REWARD POPUP — "You got…" with a tile per reward and one button to collect.
export const rewardWords = { title: 'Rewards!', collect: 'Collect' }
type Reward = { icon?: ReactNode; amount?: ReactNode; label: string }
export function RewardPopup({ rewards, onCollect, words }: { rewards: Reward[]; onCollect?: () => void; words?: Partial<typeof rewardWords> }) {
  const w = { ...rewardWords, ...words }
  return (
    <Modal title={w.title} actions={<Button onClick={() => { screens.pop(); onCollect?.() }}>{w.collect}</Button>}>
      <Grid gap="s" min="s">
        {rewards.map((r) => (
          <Card key={r.label} title={<>{r.icon} {r.amount}</>}><Text kind="caption">{r.label}</Text></Card>
        ))}
      </Grid>
    </Modal>
  )
}

// EMPTY STATE — what a list shows when there's nothing in it yet, with an optional button.
type EmptyProps = { title: string; message?: string; icon?: ReactNode; actionLabel?: string; onAction?: () => void }
export function EmptyState({ title, message, icon, actionLabel, onAction }: EmptyProps) {
  return (
    <Stack gap="s" className="kit-empty">
      {icon && <Text kind="display">{icon}</Text>}
      <Text kind="heading">{title}</Text>
      {message && <Text kind="caption">{message}</Text>}
      {actionLabel && onAction && <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>}
    </Stack>
  )
}

// SPINNER — "working on it". The label is read out by screen readers.
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="kit-spinner kit-spinner-big" role="status" aria-label={label} />
}
