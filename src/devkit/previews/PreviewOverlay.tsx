// THE PREVIEW OVERLAY — a full-screen box on top of the real game, holding the sandbox frame (frame.tsx).
//   Bar: PREVIEW badge · the screen's name · its variants · size (fit the window / phone 390×844 / desktop 1440×900,
//   scaled down to fit) · ↻ replay · what the sandbox blocked · ✕ Close. The middle ones sit in a dot carousel (◀ ▶ +
//   dots) when they don't fit — on a phone they get their own row under the badge, name and ✕.
//   It's a modal <dialog>: the real game underneath can't be touched while it's open.
//   Closing (✕, Esc, or the phone's Back) removes the frame — the real game is exactly as it was, since nothing
//   in the frame could reach it (sandbox.ts).
// Back button: opening pushes ONE history entry holding the same state as before (so the game's own screen
// stack, which counts its entries, sees no change). Back pops that entry and closes the preview, instead of
// closing a real menu or leaving the page. ✕ / Esc step back over it.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Carousel } from '../carousel/Carousel'
import type { FrameMessage } from './frame'
import { previewUrl, type DevKitPreview } from './previewTypes'
import { blockedLine } from './overlayLogic'
import type { SandboxCounts } from './sandbox'

// Searched for by the release check (check-devkit.mjs): previews are dev-only, so it must never be in a build
const PREVIEWS_MARKER = 'bmuz-devkit-previews'

type PreviewSize = 'fit' | 'phone' | 'desktop'
const SIZES: Record<Exclude<PreviewSize, 'fit'>, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
}

type Props = {
  preview: DevKitPreview
  variant: string | undefined
  onVariant: (variant: string) => void
  /** fromBack: closed by the Back button (its history entry is already gone). */
  onClose: (fromBack: boolean) => void
}

export function PreviewOverlay({ preview, variant, onVariant, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<PreviewSize>(preview.hint === 'phone' ? 'phone' : 'fit')
  const [run, setRun] = useState(0) // ↻ bumps it: a fresh frame
  const [ready, setReady] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [counts, setCounts] = useState<SandboxCounts>({ saves: 0, sends: 0, sounds: 0, history: 0 })
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  // Modal: on top of everything (the game's popovers too), the game underneath can't be touched
  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal?.()
    return () => el?.close?.()
  }, [])

  // Esc closes the preview — and only the preview (not the Dev Kit panel, not a real menu under it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeRef.current(false)
    }
    const onBack = () => closeRef.current(true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('popstate', onBack)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('popstate', onBack)
    }
  }, [])

  // What the frame says: ready, a problem, what it blocked
  useEffect(() => {
    const onMessage = (e: MessageEvent<FrameMessage>) => {
      if (e.source !== frame.current?.contentWindow || e.data?.source !== 'devkit-preview') return
      if (e.data.kind === 'ready') setReady(true)
      if (e.data.kind === 'problem') { const text = e.data.text; setProblems((list) => [...list, text]) }
      if (e.data.kind === 'counts') setCounts(e.data.counts)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // The stage's size, to scale a phone / desktop frame down to fit
  useEffect(() => {
    const el = stage.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setRoom({ width: el.clientWidth, height: el.clientHeight }))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const restart = () => {
    setReady(false)
    setProblems([])
    setCounts({ saves: 0, sends: 0, sounds: 0, history: 0 })
    setRun((n) => n + 1)
  }
  const pickVariant = (id: string) => {
    if (id === variant) return
    onVariant(id)
    restart()
  }

  const src = previewUrl(window.location.href, preview.id, variant)
  let frameStyle: CSSProperties = { width: '100%', height: '100%' }
  let boxStyle: CSSProperties = { width: '100%', height: '100%' }
  if (size !== 'fit') {
    const { width, height } = SIZES[size]
    const scale = room.width && room.height ? Math.min(1, room.width / width, room.height / height) : 1
    frameStyle = { width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }
    boxStyle = { width: width * scale, height: height * scale }
  }
  const variantLabel = preview.variants?.find((v) => v.id === variant)?.label

  return (
    <dialog ref={dialog} className="devkit-preview" data-devkit-previews={PREVIEWS_MARKER} aria-label={`Preview: ${preview.label}`}
      onCancel={(e) => e.preventDefault()}>
      <header className="dp-bar">
        <span className="dp-badge">Preview</span>
        <strong className="dp-name">{preview.label}</strong>
        {/* Variants, size, replay, what was blocked: a dot carousel when they don't all fit (a phone), no scroll bar */}
        <Carousel className="dp-options" label="Preview options">
          {preview.variants && preview.variants.length > 1 && (
            <span className="dp-group" role="group" aria-label="Variant">
              {preview.variants.map((v) => (
                <button key={v.id} className="dp-chip" aria-pressed={v.id === variant} onClick={() => pickVariant(v.id)}>{v.label}</button>
              ))}
            </span>
          )}
          <span className="dp-group" role="group" aria-label="Size">
            {(['fit', 'phone', 'desktop'] as const).map((s) => (
              <button key={s} className="dp-chip" aria-pressed={s === size} onClick={() => setSize(s)}
                title={s === 'fit' ? 'Fill this window' : `${SIZES[s].width}×${SIZES[s].height}, scaled to fit`}>
                {s === 'fit' ? 'Fit' : s === 'phone' ? 'Phone' : 'Desktop'}
              </button>
            ))}
          </span>
          <button className="dp-chip" onClick={restart} title="Play it again from the start">↻ Replay</button>
          <span className="dp-blocked" data-preview-blocked>{ready ? blockedLine(counts) : 'loading…'}</span>
        </Carousel>
        <button className="dp-close" onClick={() => onClose(false)} aria-label="Close the preview" title="Close (Esc) — back to the real game">✕ Close</button>
      </header>
      {problems.length > 0 && <p className="dp-problem" role="alert">This preview hit a problem: {problems.join(' · ')}</p>}
      <div ref={stage} className="dp-stage" data-size={size}>
        <div className="dp-box" style={boxStyle}>
          <iframe key={`${variant}-${run}`} ref={frame} className="dp-frame" style={frameStyle} src={src}
            title={`Preview: ${preview.label}${variantLabel ? ` (${variantLabel})` : ''}`}
            sandbox="allow-scripts allow-same-origin allow-forms" />
        </div>
      </div>
    </dialog>
  )
}
