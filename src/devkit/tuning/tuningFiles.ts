// Every content/tuning/*.json file in the game, found with import.meta.glob (a Vite feature that finds nothing,
// without breaking the build, when a game has no tuning folder — then the Tuning tab is hidden).
import { tuningName, type TuningData } from './tuningLogic'

export type TuningFile = { name: string; data: TuningData } // name = "physics" for content/tuning/physics.json

const found = import.meta.glob<TuningData>('../../../content/tuning/*.json', { eager: true, import: 'default' })

export const tuningFiles: TuningFile[] = Object.entries(found)
  .map(([path, data]) => ({ name: tuningName(path), data }))
  .sort((a, b) => a.name.localeCompare(b.name))
