// SCREENS TOOL (screen previews) — look at screens that are normally gated (the end screen, a handoff, an online
// lobby with 4 players…) without playing your way there. DEV ONLY: DevKit.tsx loads this tab behind
// import.meta.env.DEV, so no release build has it, even while content/devkit.json "inReleaseBuilds" is true.
//   The list comes from the game: src/devkit-game/previews.tsx (gamePreviews.ts; the API is in previewTypes.ts).
//   Picking one opens it in a sandbox over the game (PreviewOverlay.tsx + frame.tsx + sandbox.ts): sample data
//   in a separate copy of the game, badged PREVIEW. Close it and the real game is exactly where it was.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PREVIEWS_FILE, loadGamePreviews } from './gamePreviews'
import { PreviewOverlay } from './PreviewOverlay'
import { dropBackGuard, pushBackGuard } from './overlayLogic'
import { groupPreviews, type DevKitPreview } from './previewTypes'
import './previews.css'

type Open = { preview: DevKitPreview; variant: string | undefined }

export default function PreviewsTab({ load = loadGamePreviews }: { load?: () => Promise<DevKitPreview[]> }) {
  const [previews, setPreviews] = useState<DevKitPreview[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)

  useEffect(() => {
    load().then(setPreviews, (e: Error) => setProblem(e.message))
  }, [load])

  const show = (preview: DevKitPreview, variant?: string) => {
    pushBackGuard() // here, not in an effect — see PreviewOverlay.tsx
    setOpen({ preview, variant: variant ?? preview.variants?.[0]?.id })
  }
  const close = (fromBack: boolean) => {
    dropBackGuard(fromBack)
    setOpen(null)
  }

  if (problem) return <p className="devkit-not-plugged">Couldn't load the previews: {problem}</p>
  if (!previews) return <p className="devkit-not-plugged">Loading…</p>
  if (previews.length === 0) {
    return (
      <p className="devkit-not-plugged">
        No screen previews yet. Add <code>{PREVIEWS_FILE}</code> with <code>export const previews: DevKitPreview[]</code> —
        see <code>src/devkit/previews/previewTypes.ts</code>.
      </p>
    )
  }

  return (
    <div className="pv">
      <p className="pv-intro">Opens a screen with sample data in a sandbox over the game. Nothing in it is saved or sent; ✕ / Esc / Back returns you here.</p>
      {groupPreviews(previews).map(({ group, previews: list }) => (
        <section key={group} className="pv-section">
          <h3 className="pv-heading">{group}</h3>
          <ul className="pv-list">
            {list.map((p) => (
              <li key={p.id} className="pv-row">
                <div className="pv-info">
                  <span className="pv-name">{p.label}{p.hint && <span className="pv-hint">{p.hint}</span>}</span>
                  {p.note && <span className="pv-note">{p.note}</span>}
                </div>
                <div className="pv-buttons">
                  {p.variants && p.variants.length > 0
                    ? p.variants.map((v) => (
                        <button key={v.id} className="devkit-btn" data-preview={p.id} data-variant={v.id} onClick={() => show(p, v.id)}>{v.label}</button>
                      ))
                    : <button className="devkit-btn" data-preview={p.id} onClick={() => show(p)}>Open</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open && createPortal(
        <PreviewOverlay key={open.preview.id} preview={open.preview} variant={open.variant}
          onVariant={(variant) => setOpen({ ...open, variant })} onClose={close} />,
        document.body,
      )}
    </div>
  )
}
