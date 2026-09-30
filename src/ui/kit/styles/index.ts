// All style presets, by name. A game's content/ui/style.json picks one: { "preset": "clean" }.
// Every preset fills in exactly the same setting names (styles.test.ts checks this, and contrast).
import clean from './clean.json'
import cozy from './cozy.json'
import cartoon from './cartoon.json'
import pixel from './pixel.json'
import neon from './neon.json'
import type { StylePreset } from '../style/tokens'

export const presets: Record<string, StylePreset> = { clean, cozy, cartoon, pixel, neon }
