// Starts the Dev Kit. main.tsx imports this in dev, and in release builds while content/devkit.json "inReleaseBuilds" is true:
//   if (import.meta.env.DEV || __DEVKIT_IN_RELEASE__) import('./devkit/mount').then((m) => m.mountDevKit())
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DevKit } from './DevKit'

/** Adds the Dev Kit next to the game, outside #root (so colour-blind previews of the game don't filter it). */
export function mountDevKit() {
  const host = document.createElement('div')
  host.id = 'devkit-root'
  document.body.appendChild(host)
  createRoot(host).render(
    <StrictMode>
      <DevKit />
    </StrictMode>,
  )
  console.info('[devkit] Dev Kit ready — press ` (or triple-tap the top-right corner) to open')
}
