// DEV KIT RELEASE CHECK — both ways. Run from the game folder: npm run check:devkit   (/deliver runs it)
//   node src/devkit/check-devkit.mjs [--port 5198] [--base /my-game/]
//     --port: where to serve each build (default 5198 — never the usual dev ports 5173 / 5199)
//     --base: the game's web path; normally read from the build itself (dist/index.html), so leave it out
// Needs Playwright in the game: npm install -D playwright   then   npx playwright install chromium
//
// content/devkit.json "inReleaseBuilds" decides whether the live build has the Dev Kit. This builds the
// game BOTH ways (with the DEVKIT_IN_RELEASE override — content/devkit.json itself is never touched),
// serves each build with `vite preview`, and checks in a headless browser:
//   false → dist/ has NO Dev Kit code, and ` does nothing
//   true  → dist/ has the Dev Kit, ` opens it, shows the live-build note, no Save button (release builds
//           can't write files), and Copy for Claude answers (if a tab has one)
// Both ways: no screen previews (the Screens tab is dev-only) — and no preview-frame code in main.tsx's build.
// Both ways: the dev server's save endpoint is never in a build. The build matching content/devkit.json
// runs last, so dist/ is left as the real release build.
import { execSync, spawn } from 'node:child_process'
import net from 'node:net'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MARKER = 'bmuz-devkit-console' // DevKit.tsx puts it on the panel; it must be missing when the Dev Kit is off
const PREVIEWS_MARKER = 'bmuz-devkit-previews' // the Screens tab (previews/PreviewOverlay.tsx) — dev only, never in ANY build
const PRODUCTION = { NODE_ENV: 'production' } // same as the real release build

/** --port 5198 --base /x/ → { port: 5198, base: '/x/' } */
export function readArgs(args) {
  const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const port = Number(value('--port') ?? 5198)
  if (!Number.isInteger(port) || port <= 0) throw new Error(`--port must be a number (got "${value('--port')}")`)
  let base = value('--base')
  if (base !== undefined) base = ('/' + base + '/').replace(/\/+/g, '/')
  return { port, base }
}

/** The web path a build was made for, from its index.html: src="/roll-better/assets/…" → "/roll-better/" */
export function baseFromIndexHtml(html) {
  const found = html.match(/(?:src|href)="([^"]*?)assets\//)
  if (!found || !found[1].startsWith('/')) return '/' // relative ("./assets/") — preview serves it at /
  return found[1]
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => resolve(false))
  })
}

// Playwright from the game's node_modules — the full package or playwright-core, whichever it has.
// Always Playwright's own bundled Chromium, never the user's installed Chrome.
async function launchBrowser() {
  let playwright
  for (const name of ['playwright', 'playwright-core']) {
    try { playwright = await import(name); break } catch { /* try the next one */ }
  }
  if (!playwright) throw new Error('Playwright is missing: npm install -D playwright   then   npx playwright install chromium')
  return playwright.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
}

/** Every built text file's contents, joined. */
function builtText(dist) {
  const parts = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(js|css|html|json|webmanifest)$/.test(name)) parts.push(readFileSync(p, 'utf8'))
    }
  }
  walk(dist)
  return parts.join('\n')
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url)) // src/devkit/ → the game folder
  const dist = join(root, 'dist')
  const { port, base: baseArg } = readArgs(process.argv.slice(2))
  const fromFile = JSON.parse(readFileSync(join(root, 'content/devkit.json'), 'utf8')).inReleaseBuilds === true
  const failures = []
  const check = (ok, what) => {
    log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
    if (!ok) failures.push(what)
  }
  let server = null
  const stopServer = () => {
    if (!server) return
    try {
      if (process.platform === 'win32') execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' })
      else server.kill('SIGKILL')
    } catch { /* already gone */ }
    server = null
  }

  async function checkBuild(devkitOn) {
    log(`--- build with inReleaseBuilds = ${devkitOn} ---`)
    execSync('npx vite build', { cwd: root, stdio: 'ignore', env: { ...process.env, ...PRODUCTION, DEVKIT_IN_RELEASE: String(devkitOn) } })

    // 1. What's in dist/
    const all = builtText(dist)
    check(all.length > 0, 'dist/ has files')
    if (devkitOn) check(all.includes(MARKER), 'Dev Kit code IS in dist/')
    else check(!all.includes(MARKER) && !all.includes('__devkit'), 'NO Dev Kit code in dist/')
    check(!all.includes(PREVIEWS_MARKER) && !all.includes('devkit-preview='), 'NO screen previews in dist/ (they are dev-only)')
    const base = baseArg ?? baseFromIndexHtml(readFileSync(join(dist, 'index.html'), 'utf8'))
    const gameUrl = `http://localhost:${port}${base}`

    // 2. The built game in a browser
    if (await portInUse(port)) throw new Error(`port ${port} is already in use — stop whatever is running there, or use --port`)
    server = spawn(`npx vite preview --port ${port} --strictPort`, { cwd: root, shell: true, stdio: 'ignore', env: { ...process.env, ...PRODUCTION } })
    for (let i = 0; i < 200 && !(await portInUse(port)); i++) await new Promise((r) => setTimeout(r, 300))
    log(`vite preview up: ${gameUrl}`)
    const browser = await launchBrowser()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${port}` })
      const page = await context.newPage()
      const devkitFiles = []
      page.on('request', (r) => { if (/\/mount-[^/]*\.js/.test(r.url())) devkitFiles.push(r.url()) })
      await page.goto(gameUrl, { waitUntil: 'load' })
      await page.waitForTimeout(3000) // let the game (and the Dev Kit, if it's there) start
      await page.keyboard.press('Backquote')
      await page.waitForTimeout(500)
      const panel = page.locator('aside.devkit')

      if (devkitOn) {
        check(await panel.isVisible(), '` opens the Dev Kit')
        check(await page.locator('.devkit-live-note').isVisible(), 'panel shows the live-build note')
        check(await panel.getByRole('button', { name: 'Save', exact: true }).count() === 0, 'no Save button (release builds cannot write files)')
        const copy = panel.getByRole('button', { name: 'Copy for Claude' }).first()
        if (await copy.isVisible()) {
          await copy.click()
          await page.waitForTimeout(300)
          const status = await panel.locator('.devkit-status').first().textContent().catch(() => '')
          check(/Copied|blocked copying/.test(status ?? ''), `Copy for Claude answers ("${status}")`)
        } else log('  (no Copy for Claude button on the first tab — skipped)')
      } else {
        check(await panel.count() === 0, '` does nothing (no Dev Kit panel)')
        check(devkitFiles.length === 0, 'no Dev Kit file was loaded')
      }

      // The Save endpoint only lives in the dev server — never in a build
      const saveStatus = await page.evaluate(async (url) => {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"path":"content/devkit.json","data":{}}' })
        return res.status
      }, `${base}__devkit/save`)
      check(saveStatus === 404, `save endpoint doesn't exist (POST → ${saveStatus})`)
      await context.close()
    } finally {
      await browser.close()
      stopServer()
    }
  }

  try {
    await checkBuild(!fromFile) // the other setting first…
    await checkBuild(fromFile) // …then content/devkit.json's own, so dist/ ends up as the real release build
  } catch (e) {
    failures.push(String(e.message ?? e))
    stopServer()
  }
  console.log(failures.length
    ? `FAIL — ${failures.length} problem(s):\n- ${failures.join('\n- ')}`
    : `PASS — Dev Kit release check, both ways (content/devkit.json: inReleaseBuilds = ${fromFile})`)
  process.exit(failures.length ? 1 : 0)
}

// Run from the command line (the tests import readArgs / baseFromIndexHtml without running it)
if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
