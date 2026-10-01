// Copies the official word list (public/words/words.csv) to party/words.gen.txt so the online server
// can bundle it as text (esbuild reads .txt files as text; it has no loader for .csv).
// wrangler.json (build.command) runs this before every `wrangler dev` / `wrangler deploy` build. The copy is gitignored.
import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
copyFileSync(resolve(root, 'public/words/words.csv'), resolve(root, 'party/words.gen.txt'))
console.log('server word list: party/words.gen.txt')
