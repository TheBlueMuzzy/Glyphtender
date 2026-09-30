// Returning player gets a new release on their FIRST visit (offline cache swaps itself). Guards the registerSW({ immediate: true }) line in src/main.tsx.
// Copied from Roll Better (B020). Builds twice (the second with version.json build 99, restored after) and serves
// on its own port (default 5194). "New version" = the page runs the second build's main script (its file name
// changes with the build). Run alone: npm run e2e:update [port]
import { chromium } from 'playwright-core'
import { execSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.argv[2] ?? 5194)
const URL = `http://localhost:${PORT}/glyphtender/`
const RELEASE = { ...process.env, NODE_ENV: 'production' } // same as the real release build (base /glyphtender/)
const sh = (c) => execSync(c, { stdio: 'pipe', env: RELEASE })
const vj = readFileSync('version.json', 'utf8')
// The build marker: dist/index.html's main script, e.g. /glyphtender/assets/main-AbC123.js
const builtScript = () => readFileSync('dist/index.html', 'utf8').match(/src="([^"]*assets\/[^"]+\.js)"/)[1]
const pageScript = (p) => p.evaluate(() => document.querySelector('script[type="module"][src*="assets/"]')?.getAttribute('src') ?? 'none')

const portFree = (port) => new Promise((ok) => {
  const probe = netServer().once('error', () => ok(false)).once('listening', () => probe.close(() => ok(true))).listen(port)
})
if (!(await portFree(PORT))) throw new Error(`Port ${PORT} is busy — pass another: npm run e2e:update <port>`)

let server, ctx, result = 1
try {
  sh('npx vite build')
  const firstBuild = builtScript()
  server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, env: RELEASE })
  await new Promise((r) => setTimeout(r, 4000))
  ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sw-')), { viewport: { width: 1280, height: 720 } })
  const p = ctx.pages()[0] || (await ctx.newPage())
  let reloads = 0
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) reloads++ })
  await p.goto(URL)
  await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 })
  await p.waitForTimeout(1500)
  console.log('first visit:', await pageScript(p), firstBuild === (await pageScript(p)) ? '(build 1)' : '(?)')
  // publish a "next release" underneath the open page
  const v = JSON.parse(vj); v.build = 99
  writeFileSync('version.json', JSON.stringify(v, null, 2) + '\n')
  sh('npx vite build')
  const secondBuild = builtScript()
  if (secondBuild === firstBuild) throw new Error('the second build has the same main script — nothing to update to')
  const before = reloads
  // what a returning player does: open the link again
  await p.goto(URL)
  await p.waitForTimeout(12000)
  const shown = await pageScript(p)
  console.log('after one visit:', shown, '| page swapped itself:', reloads - before > 1 ? 'yes' : 'no')
  result = shown === secondBuild ? 0 : 1
} finally {
  writeFileSync('version.json', vj)
  await ctx?.close()
  if (server) { try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }) } catch {} }
}
console.log(result === 0 ? 'PASS — returning player sees the new version on the first visit' : 'FAIL — returning player still sees the old version')
process.exit(result)
