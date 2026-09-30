// Shared by every Dev Kit tool: write a content/ JSON file, and copy text for Claude.

/**
 * Can this build write content/ files? Only under `npm run dev` — the Save endpoint lives in the dev server.
 * A release build (the live link, while content/devkit.json has the Dev Kit on) can't: there,
 * tools show "Copy for Claude" instead of Save, and changes last only until a refresh.
 */
export const CAN_SAVE = import.meta.env.DEV

/** Write a content/ JSON file through the dev server (vite-plugins/devkit/devkitVite.ts). Throws with a plain reason. */
export async function saveContentFile(path: string, data: object): Promise<void> {
  let res: Response
  try {
    res = await fetch('/__devkit/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, data }),
    })
  } catch {
    throw new Error('the dev server is not reachable (is npm run dev still running?)')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `the dev server said ${res.status}`)
}

/** Copy text to the clipboard. Returns false if the browser refused (e.g. a phone on http://) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older way — works on plain http:// pages where the clipboard API is blocked
    const box = document.createElement('textarea')
    box.value = text
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    const ok = document.execCommand('copy')
    box.remove()
    return ok
  }
}
