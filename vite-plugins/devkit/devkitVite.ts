// THE DEV KIT'S VITE PLUGIN — from the Game Framework (devkit/), copied into the game's vite-plugins/devkit/.
// In vite.config.ts:   import { devkit } from './vite-plugins/devkit/devkitVite'
//                      plugins: [react(), devkit()]
// It does two jobs:
//   1. The on/off switch for release builds: reads content/devkit.json "inReleaseBuilds" and bakes it into the
//      code as __DEVKIT_IN_RELEASE__ (main.tsx reads it). DEVKIT_IN_RELEASE=true|false overrides it for one build —
//      the release check (src/devkit/check-devkit.mjs) uses that to test both ways.
//   2. The Save endpoint, dev server only (never in a build):
//        POST /__devkit/save   body: { "path": "content/ui/style.json", "data": { ... } }
//      Safety: only .json files inside content/ — nothing else in the project can be written — plus one
//      exception: bug captures (the Bug capture tab) go in .planning/bugs/, where /bug keeps them.
//      A missing folder is refused, except the two the Dev Kit's own tools fill (MADE_ON_FIRST_SAVE).
//      Files are written pretty-printed (2 spaces) with a trailing newline, and a "_help" note already
//      in the file is kept even if the tool didn't send it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

export const SAVE_URL = '/__devkit/save'

/** Folders the Save endpoint makes if missing: Snapshots' files, and Bug capture's (where /bug looks). */
export const MADE_ON_FIRST_SAVE = ['content/snapshots', '.planning/bugs']

/** Is the Dev Kit in release builds? The DEVKIT_IN_RELEASE override, else content/devkit.json, else off. */
export function devkitInReleaseBuilds(root: string, override = process.env.DEVKIT_IN_RELEASE): boolean {
  if (override === 'true') return true
  if (override === 'false') return false
  if (override !== undefined) throw new Error(`DEVKIT_IN_RELEASE must be true or false (got "${override}")`)
  const file = join(root, 'content', 'devkit.json')
  if (!existsSync(file)) return false
  return JSON.parse(readFileSync(file, 'utf8')).inReleaseBuilds === true
}

/** Is this a path the Dev Kit may write? e.g. "content/ui/style.json" yes; "src/App.tsx", "../x.json" no. */
export function isAllowedContentPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (!path.startsWith('content/')) return false // relative, forward slashes, inside content/
  if (!path.endsWith('.json')) return false
  if (path.includes('\\') || path.includes('\0')) return false
  const parts = path.split('/')
  return parts.every((part) => part !== '' && part !== '.' && part !== '..')
}

/** A bug capture's file: ".planning/bugs/capture-2026-09-30-23-15-07.json" yes; anything deeper or else, no. */
export function isAllowedBugCapturePath(path: unknown): path is string {
  return typeof path === 'string' && /^\.planning\/bugs\/[A-Za-z0-9_-]+\.json$/.test(path)
}

/** Keep the file's "_help" note (first, as it was) if the new data doesn't bring its own. */
export function keepHelp(existing: unknown, incoming: Record<string, unknown>): Record<string, unknown> {
  const help = (existing as Record<string, unknown> | null)?._help
  if (help === undefined || '_help' in incoming) return incoming
  return { _help: help, ...incoming }
}

// A list of plain numbers / true / false / null that JSON.stringify spread over lines. It must start with
// "[" + a line break, which never happens inside a text value (there a line break is written as \n).
const SHORT_LIST = /\[\n\s*((?:[-\d.eE+]+|true|false|null)(?:,\n\s*(?:[-\d.eE+]+|true|false|null))*)\n\s*\]/g

/**
 * How every Dev Kit file is written: 2-space JSON + a newline at the end (like a hand-edited file).
 * Lists of plain numbers / true / false stay on one line — [8, 6, 4, 2, 1] — the way people write them.
 */
export function formatJson(data: unknown): string {
  const pretty = JSON.stringify(data, null, 2)
  return pretty.replace(SHORT_LIST, (_, items: string) => `[${items.split(/,\s*/).join(', ')}]`) + '\n'
}

// Same file, same key — whatever slashes or drive-letter case the path came with (Windows)
const fileKey = (file: string) => resolve(file).toLowerCase()

/** Both jobs in one plugin — see the top of this file. */
export function devkit(): Plugin {
  let root = process.cwd()
  // Files we just wrote: Vite would hot-reload the game for them, but the game already shows
  // those values live, so we skip that reload (it would reset the game under Muzzy's feet).
  const justWrote = new Map<string, number>()

  return {
    name: 'bmuz-devkit',
    // 1. The release-build switch. When it's false, main.tsx's Dev Kit import is dead code
    //    and none of src/devkit/ reaches the live build.
    config(config) {
      const inRelease = devkitInReleaseBuilds(resolve(config.root ?? process.cwd()))
      return { define: { __DEVKIT_IN_RELEASE__: JSON.stringify(inRelease) } }
    },
    configResolved(config) {
      root = config.root
    },
    // 2. The Save endpoint (configureServer only runs for the dev server)
    configureServer(server) {
      // "null" or junk in the Origin header → no host, so the request is refused instead of crashing
      const originHost = (origin: string) => {
        try { return new URL(origin).host } catch { return '' }
      }
      server.middlewares.use(SAVE_URL, (req, res) => {
        const reply = (status: number, body: object) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return reply(405, { error: 'POST only' })
        // Only the game's own page may save: the dev server is on the Wi-Fi (--host), and any web page
        // could otherwise POST here. A same-page fetch sends Origin = this server; JSON forces that check.
        const origin = req.headers.origin
        const host = req.headers.host
        if (!origin || !host || originHost(origin) !== host) return reply(403, { error: 'Save only from the game page' })
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return reply(415, { error: 'JSON only' })

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          try {
            // Join the raw bytes first, so a character split across two chunks (like "—") stays whole
            const { path, data } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const isCapture = isAllowedBugCapturePath(path)
            if (!isAllowedContentPath(path) && !isCapture) return reply(400, { error: `Not allowed: only .json files inside content/, or bug captures in .planning/bugs/ (got ${path})` })
            if (typeof data !== 'object' || data === null || Array.isArray(data)) return reply(400, { error: 'data must be a JSON object' })

            const allowedDir = resolve(root, isCapture ? '.planning/bugs' : 'content')
            const file = resolve(root, path)
            if (!file.startsWith(allowedDir + sep)) return reply(400, { error: 'Not allowed: outside content/' })
            if (!existsSync(dirname(file))) {
              if (!MADE_ON_FIRST_SAVE.includes(dirname(path))) return reply(400, { error: `No such folder: ${dirname(path)}` })
              mkdirSync(dirname(file), { recursive: true })
            }

            const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
            justWrote.set(fileKey(file), Date.now())
            writeFileSync(file, formatJson(keepHelp(existing, data)))
            server.config.logger.info(`[devkit] saved ${path}`, { timestamp: true })
            reply(200, { ok: true, path })
          } catch (e) {
            reply(500, { error: String(e) })
          }
        })
      })
    },
    handleHotUpdate({ file }) {
      const wroteAt = justWrote.get(fileKey(file))
      if (wroteAt !== undefined && Date.now() - wroteAt < 3000) {
        justWrote.delete(fileKey(file))
        return [] // no reload — see justWrote above
      }
    },
  }
}
