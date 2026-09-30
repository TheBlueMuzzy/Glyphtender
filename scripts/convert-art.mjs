// One-off: shrink the original's stand-in art (2000 px PNG) to web size (256 px WebP).
// Source is the read-only original: ../glyphtender-original. Re-run if Muzzy redraws the art there.
import sharp from 'sharp'
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = '../glyphtender-original/Unity/GlyphtenderUnity/Assets/Art'
const OUT = 'public/art'
const SIZE = 256
mkdirSync(join(OUT, 'runeblossoms'), { recursive: true })
mkdirSync(join(OUT, 'glyphlings'), { recursive: true })

for (const file of readdirSync(join(SRC, 'Runeblossoms')).filter((f) => f.endsWith('.png'))) {
  const [, letter, colour] = file.match(/Glyphtender_(\w+) (\w+)\.png/)
  await sharp(join(SRC, 'Runeblossoms', file)).resize(SIZE).webp({ quality: 82 })
    .toFile(join(OUT, 'runeblossoms', `${letter.toLowerCase()}-${colour.toLowerCase()}.webp`))
}
for (const colour of ['Yellow', 'Blue', 'Purple', 'Pink']) {
  const src = join(SRC, `Glyphtender_Glyphling-${colour}.png`)
  await sharp(src).resize(SIZE).webp({ quality: 85 }).toFile(join(OUT, 'glyphlings', `${colour.toLowerCase()}.webp`))
}
// App icons from the yellow glyphling
const icon = join(SRC, 'Glyphtender_Glyphling-Yellow.png')
await sharp(icon).resize(192).png().toFile('public/pwa-192x192.png')
await sharp(icon).resize(512).png().toFile('public/pwa-512x512.png')
console.log('done')
