// Colour-blind preview: shows the game (#root) the way players with colour-blindness see it.
// Uses an SVG colour filter per type — Machado et al. 2009 simulation matrices, full strength,
// applied in linear RGB (the SVG filter default). The Dev Kit panel itself is not filtered.
import { useEffect, useState } from 'react'

const MODES = {
  none: { name: 'None', matrix: '' },
  deuteranopia: {
    name: 'Deuteranopia (green-weak)',
    matrix: '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0',
  },
  protanopia: {
    name: 'Protanopia (red-weak)',
    matrix: '0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0',
  },
  tritanopia: {
    name: 'Tritanopia (blue-weak)',
    matrix: '1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0',
  },
} as const
type Mode = keyof typeof MODES

export function ColourBlindPreview() {
  const [mode, setMode] = useState<Mode>('none')

  useEffect(() => {
    const game = document.getElementById('root')
    if (!game) return
    game.style.filter = mode === 'none' ? '' : `url(#devkit-cb-${mode})`
    return () => {
      game.style.filter = ''
    }
  }, [mode])

  return (
    <label className="ct-cb">
      <span>Colour-blind preview</span>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
        {Object.entries(MODES).map(([id, m]) => (
          <option key={id} value={id}>
            {m.name}
          </option>
        ))}
      </select>
      <svg width="0" height="0" aria-hidden="true" className="ct-cb-defs">
        <defs>
          {Object.entries(MODES).map(([id, m]) =>
            m.matrix ? (
              <filter key={id} id={`devkit-cb-${id}`}>
                <feColorMatrix type="matrix" values={m.matrix} />
              </filter>
            ) : null,
          )}
        </defs>
      </svg>
    </label>
  )
}
