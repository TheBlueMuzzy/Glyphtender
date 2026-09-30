// THE STYLE ENGINE — turns content/ui/style.json into CSS variables on <html>.
// style.json looks like: { "preset": "clean", "tweaks": { "accent": "#e07a5f" } }
// Tweaks win over the preset. Call applyStyle again any time to restyle live.
import { presets } from '../styles'
import { allVariableNames, optionalTokens, type StylePreset, type StyleTweaks } from './tokens'

export type StyleFile = { preset: string; tweaks?: StyleTweaks }

const BODY_TEXT_REM = 1.125 // 18px — the accessibility floor for all text
// Spacing and tap targets are in px on purpose: when a player zooms text to 200%,
// the words grow but the gaps and 44px targets don't eat the extra room.
const SPACING_STEP_PX = 4 // the spacing scale is built from this
const TARGET_MIN_PX = 44 // accessibility floor: smallest tap target
const GAP_STEPS = { 'gap-xs': 1, 'gap-s': 2, 'gap-m': 4, 'gap-l': 6, 'gap-xl': 8 }

const rem = (n: number) => `${Math.round(n * 1000) / 1000}rem`

// Works out every CSS variable value. Pure, so it can be tested without a browser.
export function resolveStyle(file: StyleFile): Record<string, string> {
  const preset = presets[file.preset] ?? presets.clean
  if (!presets[file.preset]) console.warn(`[ui-kit] unknown preset "${file.preset}", using clean`)

  const s: StylePreset = { ...optionalTokens, ...preset, ...file.tweaks }
  for (const name of Object.keys(file.tweaks ?? {})) {
    if (!allVariableNames.includes(name)) console.warn(`[ui-kit] unknown tweak "${name}" ignored`)
  }

  // Accessibility floor: text is never smaller than 18px, whatever the style says.
  const textSize = Math.max(1, Number(s['text-size']) || 1)
  const scale = Number(s['font-scale']) || 1.25
  const density = Number(s.density) || 1
  const body = BODY_TEXT_REM * textSize

  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(s)) {
    if (allVariableNames.includes(name)) vars[name] = String(value)
  }
  vars['text-size'] = String(textSize)
  vars['text-body'] = rem(body)
  vars['text-heading'] = rem(body * scale)
  vars['text-title'] = rem(body * scale ** 2)
  vars['text-display'] = rem(body * scale ** 3)
  for (const [name, steps] of Object.entries(GAP_STEPS)) vars[name] = `${Math.round(SPACING_STEP_PX * steps * density)}px`
  vars['target-min'] = `${TARGET_MIN_PX}px`
  return vars
}

export function applyStyle(file: StyleFile, target: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(resolveStyle(file))) target.style.setProperty(`--${name}`, value)
}
