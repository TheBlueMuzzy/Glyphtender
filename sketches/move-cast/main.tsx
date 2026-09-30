import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Sketch } from './Sketch'

// Dev Kit (` key or triple-tap) — tweak layout sizes and garden colours live while trying the sketch
if (import.meta.env.DEV || __DEVKIT_IN_RELEASE__) {
  import('../../src/devkit/mount').then((m) => m.mountDevKit())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sketch />
  </StrictMode>,
)
