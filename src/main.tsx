import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { applyStyle, applyAccessibility, loadSettings } from './ui/kit'
import style from '../content/ui/style.json'
import { settings } from './ui/gameSettings'
import { startFullscreen } from './ui/fullscreen'

applyStyle(style) // content/ui/style.json → the UI kit's look (Cozy, night colours)
applyAccessibility(loadSettings(settings)) // text size + reduce motion before any screen opens

// Dev Kit → Screens: this page is a PREVIEW sandbox inside the Dev Kit (dev only — never in a release build).
// It shows one screen with sample data (src/devkit-game/previews.tsx); saves, sends and history are blocked.
if (import.meta.env.DEV && location.search.includes('devkit-preview=')) {
  import('./devkit/previews/frame').then((m) => m.startPreviewFrame({ app: <App />, root: document.getElementById('root')! }))
} else {
  startGame()
}

function startGame() {
  // Offline cache: when a new release is out it downloads in the background and the page swaps
  // to it straight away — returning players never see an old version (Roll Better B020).
  registerSW({ immediate: true })

  // Full screen: phones go full screen on a tap (Settings → Display → Full screen); src/ui/fullscreen.ts
  startFullscreen(() => loadSettings(settings))

  // Dev Kit (` key or triple-tap) — always in local dev; in release builds only while content/devkit.json
  // "inReleaseBuilds" is true (until 1.0). When both are false this import is dead code and never ships.
  if (import.meta.env.DEV || __DEVKIT_IN_RELEASE__) {
    import('./devkit/mount').then((m) => m.mountDevKit())
  }

  // Dev only: window.__glyphtender for the e2e check and the console (src/game/devHook.ts)
  if (import.meta.env.DEV) import('./game/devHook').then((m) => m.installDevHook())

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
