// Tuning values (content/tuning/*.json) that re-draw the screen when the Dev Kit changes them.
// Fine for layout and colours, which change rarely. Per-frame animation code reads them once when it starts.
import { useEffect, useState } from 'react'
import { liveTuning, onTuning } from '../devkit/tuning/liveTuning'
import layoutFile from '../../content/tuning/layout.json'
import gardenFile from '../../content/tuning/garden.json'
import animFile from '../../content/tuning/anim.json'
import endscreenFile from '../../content/tuning/endscreen.json'

export type LayoutTuning = typeof layoutFile
export type GardenTuning = typeof gardenFile
export type AnimTuning = typeof animFile

function useTuningState<T>(file: string, initial: T): T {
  const [value, setValue] = useState<T>(() => liveTuning(file, initial).current)
  useEffect(() => onTuning<T>(file, setValue), [file])
  return value
}

export const useLayoutTuning = () => useTuningState('layout', layoutFile)
export const useGardenTuning = () => useTuningState('garden', gardenFile)
export const useAnimTuning = () => useTuningState('anim', animFile)
export const useEndTuning = () => useTuningState('endscreen', endscreenFile)
