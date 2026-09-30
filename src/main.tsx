import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Offline cache: when a new release is out it downloads in the background and the page swaps
// to it straight away — returning players never see an old version (Roll Better B020).
registerSW({ immediate: true })

// Dev Kit (` key or triple-tap) — always in local dev; in release builds only while content/devkit.json
// "inReleaseBuilds" is true (until 1.0). When both are false this import is dead code and never ships.
if (import.meta.env.DEV || __DEVKIT_IN_RELEASE__) {
  import('./devkit/mount').then((m) => m.mountDevKit())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
