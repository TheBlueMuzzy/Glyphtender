// The Color tab edits the game's UI kit colours: it needs the UI kit (src/ui/kit) and its style file
// (content/ui/style.json). A game without the UI kit has neither — so instead of plain imports, which would
// break that game's build, they're looked up with import.meta.glob (a Vite feature that simply finds
// nothing when a file is missing). No UI kit → the Color tab shows only the colour-blind preview.
type StyleFile = { preset: string; tweaks?: Record<string, unknown> }
type UiKit = {
  applyStyle: (style: StyleFile) => void
  presets: Record<string, Record<string, unknown>>
}

const kitFiles = import.meta.glob<UiKit>('../../ui/kit/index.ts', { eager: true })
const styleFiles = import.meta.glob<StyleFile>('../../../content/ui/style.json', { eager: true, import: 'default' })

export const uiKit: UiKit | undefined = Object.values(kitFiles)[0]
export const styleFile: StyleFile | undefined = Object.values(styleFiles)[0]
