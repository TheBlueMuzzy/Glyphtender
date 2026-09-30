// RULE CHECKER — keeps UI code built only from style names. Ships inside the kit, so a game runs:
//   node src/ui/kit/check-ui.mjs src/ui          (point it at the folders that hold UI code)
//   node src/ui/kit/check-ui.mjs src/ui --css src   (also: warn about game CSS that restyles kit parts)
// With no folders it checks the kit itself. In the framework: npm run check-ui (kit + gallery).
// Fails on:
//   1. raw colours (#hex, rgb(), hsl())       → use a colour name: var(--primary)
//   2. px sizes                                → use gap names / rem
//   3. font names                              → use var(--font-body) / var(--font-display)
//   4. position:absolute/fixed outside Screen (and the stack's overlay) → use Screen slots, Stack, Row, Grid
//   5. inline style= (except setting --css-variables)
//   6. var(--something) that isn't a style name from kit/style/tokens.ts (or a --kit-… helper)
// --css <folders>: every .css file in them (outside the kit's own folder) is also checked for rules that
// restyle kit parts — a selector naming a .kit-… class. Those are WARNINGS (they don't fail the check):
// the look belongs in the style file, and a kit update may quietly break them. A rule that only sets
// CSS variables (--kit-frame-w, --kit-overlay-z…) is fine.
// The style engine (kit/style/), the presets (kit/styles/), the font files (kit/fonts/ — their
// @font-face rules must name each font) and tests are allowed raw values.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// Node 22.18+ reads .ts files directly (type stripping), so no build step is needed
import { allVariableNames } from './style/tokens.ts'

const EXEMPT = [/kit[\\/]style[\\/]/, /kit[\\/]styles[\\/]/, /kit[\\/]fonts[\\/]/, /\.test\./]

// Replace comments with spaces (keeping line breaks) so notes like "44px" don't count.
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\/|(?<![:'"])\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '))

const lineOf = (text, index) => text.slice(0, index).split('\n').length

function valueProblems(value) {
  const found = []
  if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/.test(value)) found.push('raw colour — use a colour name like var(--primary)')
  if (/\d(\.\d+)?px\b/.test(value)) found.push('px size — use a gap name or rem')
  for (const [, name] of value.matchAll(/var\(--([\w-]+)/g)) {
    if (!allVariableNames.includes(name) && !name.startsWith('kit-')) found.push(`unknown style name --${name}`)
  }
  return found
}

function checkCss(text) {
  const problems = []
  // Each innermost "selector { declarations }" block
  for (const rule of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim()
    let offset = rule.index + rule[1].length + 1
    for (const decl of rule[2].split(';')) {
      const [property = '', ...rest] = decl.split(':')
      const prop = property.trim(), value = rest.join(':').trim()
      const at = lineOf(text, offset + decl.search(/\S|$/))
      offset += decl.length + 1
      if (!prop || prop.startsWith('--')) continue // CSS variable definitions are allowed
      const report = (message) => problems.push({ line: at, message, snippet: `${prop}: ${value}` })
      valueProblems(value).forEach(report)
      if (/^font(-family)?$/.test(prop) && !/^(var\(|inherit)/.test(value)) report('font name — use var(--font-body) or var(--font-display)')
      if (prop === 'position' && /absolute|fixed/.test(value) && !/\.kit-(screen|overlay)\b/.test(selector)) report('position:absolute/fixed — only Screen slots (and the stack overlay) may do this')
    }
  }
  return problems
}

function checkScript(text) {
  const problems = []
  text.split('\n').forEach((line, i) => {
    const report = (message) => problems.push({ line: i + 1, message, snippet: line.trim() })
    valueProblems(line).forEach(report)
    if (/fontFamily/.test(line)) report('font name — use var(--font-body) or var(--font-display)')
    if (/position:\s*['"](absolute|fixed)/.test(line)) report('position:absolute/fixed — only Screen slots may do this')
  })
  // Inline styles: only style={{ '--name': value }} is allowed
  for (const m of text.matchAll(/style=\{(\{[^}]*\})?/g)) {
    const keys = m[1] ? [...m[1].matchAll(/([\w'"-]+)\s*:/g)].map((k) => k[1]) : ['(not an object)']
    if (keys.some((k) => !/^['"]--/.test(k))) {
      problems.push({ line: lineOf(text, m.index), message: 'inline style — only setting CSS variables is allowed', snippet: m[0] })
    }
  }
  return problems
}

// Check one file's text. Returns [{ line, message, snippet }].
export function checkSource(path, text) {
  if (EXEMPT.some((rule) => rule.test(path))) return []
  const clean = stripComments(text)
  if (path.endsWith('.css')) return checkCss(clean)
  if (/\.(tsx?|jsx?)$/.test(path)) return checkScript(clean)
  return []
}

// Game CSS that restyles kit parts: rules whose selector names a .kit-… class. Returns [{ line, message, snippet }].
export function findKitRestyles(path, text) {
  if (/(^|[\\/])kit[\\/]/.test(path) ||!path.endsWith('.css')) return [] // the kit's own CSS may style itself
  const clean = stripComments(text)
  const warnings = []
  for (const rule of clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const kitClasses = [...new Set(rule[1].match(/\.kit-[\w-]+/g) ?? [])]
    if (!kitClasses.length) continue
    const properties = rule[2].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean)
    if (properties.every((p) => p.startsWith('--'))) continue // only sets CSS variables
    const selector = rule[1].trim()
    const line = lineOf(clean, rule.index + rule[1].search(/\S/))
    warnings.push({ line, message: `restyles kit part ${kitClasses.join(' ')} — change the style file or a kit option instead`, snippet: selector })
  }
  return warnings
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

// Check every file in these folders, print each problem, and return how many there were.
// cssFolders: also warn about CSS in these folders that restyles kit parts (warnings don't count as problems).
export function checkFolders(folders, cssFolders = []) {
  const files = folders.flatMap(listFiles)
  let count = 0
  for (const file of files) {
    for (const p of checkSource(file, readFileSync(file, 'utf8'))) {
      count++
      console.log(`${relative('.', file)}:${p.line}  ${p.message}
    ${p.snippet}`)
    }
  }
  let warningCount = 0
  const cssFiles = cssFolders.flatMap(listFiles).filter((file) => file.endsWith('.css'))
  for (const file of cssFiles) {
    for (const w of findKitRestyles(file, readFileSync(file, 'utf8'))) {
      warningCount++
      console.log(`${relative('.', file)}:${w.line}  ⚠ ${w.message}
    ${w.snippet}`)
    }
  }
  console.log(count ? `
✗ ${count} rule problem(s) in UI code` : `✓ UI rules pass (${files.length} files checked)`)
  if (cssFolders.length) console.log(warningCount ? `⚠ ${warningCount} warning(s): game CSS restyling kit parts` : `✓ no game CSS restyles kit parts (${cssFiles.length} CSS files checked)`)
  return count
}

// Splits the command line into UI folders and, after --css, the folders whose CSS gets the kit-restyle warnings.
export function readArguments(args) {
  const split = args.indexOf('--css')
  if (split === -1) return { folders: args, cssFolders: [] }
  return { folders: args.slice(0, split), cssFolders: args.slice(split + 1) }
}

// Run from the command line
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { folders, cssFolders } = readArguments(process.argv.slice(2))
  process.exit(checkFolders(folders.length ? folders : [dirname(fileURLToPath(import.meta.url))], cssFolders) ? 1 : 0)
}
