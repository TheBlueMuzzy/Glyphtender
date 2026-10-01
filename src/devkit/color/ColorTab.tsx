// COLOR TOOL — the colour-blind preview, and every UI kit colour with a picker each.
//   UI colours come from content/ui/style.json: the preset's colours, with "tweaks" on top.
// ↺ on a colour = back to the preset. A dot next to a name = changed, not saved yet.
// The Dev Kit's search box filters the colours (DevKitSearch); the colour-blind preview hides while searching.
// A game's own colours (e.g. a 3D table) go in a game tab: src/devkit-game/ (ColourRow is free to use there).
import { useContext, useEffect, useState } from 'react'
import { Highlight, Section } from '../search/Section'
import { DevKitSearch } from '../search/searchContext'
import { searchTerms } from '../search/searchLogic'
import { CAN_SAVE, copyText, saveContentFile } from '../saveContent'
import { ColourBlindPreview } from './ColourBlindPreview'
import { ColourRow } from './ColourRow'
import { UI_COLOUR_SECTION, copyForClaudeText, searchUiColours, listChanges, sameColour, tweaksToSave, uiChanged, uiColoursFrom, uiLabel } from './colorLogic'
import { styleFile, uiKit } from './uiKit'
import './color.css'

export function ColorTab() {
  const { query } = useContext(DevKitSearch) // the Dev Kit's search box ('' = show everything)
  const searching = searchTerms(query).length > 0
  return (
    <div className="ct">
      {!searching && (
        <>
          <p className="ct-legend">
            <span className="ct-dot" /> = changed, not saved yet · tap a swatch to pick a colour, or type a hex
          </p>
          <ColourBlindPreview />
        </>
      )}
      {uiKit && styleFile ? (
        <UiColoursEditor />
      ) : (
        <p className="ct-legend">This game doesn't use the Game UI kit (src/ui/kit + content/ui/style.json), so there are no UI colours to edit here.</p>
      )}
    </div>
  )
}

function UiColoursEditor() {
  const { query, goTo } = useContext(DevKitSearch)
  // Only shown when both exist (see ColorTab)
  const kit = uiKit!
  const file = styleFile!
  const presetName = file.preset
  const preset = kit.presets[presetName] ?? kit.presets.clean
  const presetTitle = presetName.charAt(0).toUpperCase() + presetName.slice(1) // "Cartoon"
  const fromFile = () => uiColoursFrom(preset, file.tweaks)

  const [colours, setColours] = useState(fromFile) // what the game shows right now
  const [saved, setSaved] = useState(fromFile) // what's in the file
  const [savedTweaks, setSavedTweaks] = useState(file.tweaks ?? {}) // style.json "tweaks" as saved
  const [loaded] = useState(fromFile) // as the page loaded — Copy for Claude lists changes since then
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null) // shown if the clipboard is blocked

  const dirty = uiChanged(colours, saved)
  const terms = searchTerms(query)
  const found = terms.length > 0 ? searchUiColours(query) : [{ ...UI_COLOUR_SECTION, titleHit: false }]

  // Live preview: the UI restyles through the kit's style engine
  useEffect(() => {
    kit.applyStyle({ preset: presetName, tweaks: tweaksToSave(preset, colours, savedTweaks) })
  }, [kit, preset, presetName, colours, savedTweaks])

  // Save: style.json gets only the colours that differ from the preset
  async function save() {
    setStatus({ kind: 'info', text: 'Saving…' })
    try {
      const tweaks = tweaksToSave(preset, colours, savedTweaks)
      await saveContentFile('content/ui/style.json', { ...file, tweaks })
      setSavedTweaks(tweaks)
      setSaved(colours)
      setStatus({ kind: 'ok', text: 'Saved content/ui/style.json — refresh and it stays.' })
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't save: ${(e as Error).message}` })
    }
  }

  async function copyForClaude() {
    const text = copyForClaudeText(document.title, listChanges(loaded, colours), !dirty, !CAN_SAVE)
    if (await copyText(text)) {
      setCopyFallback(null)
      setStatus({ kind: 'ok', text: 'Copied — paste it into your chat with Claude.' })
    } else {
      setCopyFallback(text)
      setStatus({ kind: 'error', text: 'The browser blocked copying — select the text below and copy it.' })
    }
  }

  return (
    <>
      {found.map((section) => (
        <Section
          key={section.id}
          id={section.id}
          title={section.title}
          count={section.items.length}
          terms={terms}
          defaultOpen
          changed={dirty}
          onGoTo={() => goTo(section.id)}
        >
          <p className="ct-legend">content/ui/style.json · ↺ = back to the {presetTitle} preset</p>
          {section.items.map(({ token, name }) => (
            <ColourRow
              key={token}
              label={uiLabel(token)}
              display={<Highlight text={`${name} (${token})`} terms={terms} />}
              value={colours[token]}
              changed={!sameColour(colours[token], saved[token])}
              resetTo={String(preset[token])}
              resetHint={`Back to the ${presetTitle} preset`}
              onChange={(v) => setColours((c) => ({ ...c, [token]: v }))}
            />
          ))}
        </Section>
      ))}

      <footer className="devkit-footer">
        {/* Live build: no dev server to save through, so Copy for Claude is the main button (see CAN_SAVE) */}
        {CAN_SAVE && (
          <button className="devkit-btn devkit-btn-main" disabled={!dirty} onClick={save}>
            Save
          </button>
        )}
        <button className={CAN_SAVE ? 'devkit-btn' : 'devkit-btn devkit-btn-main'} onClick={copyForClaude}>
          Copy for Claude
        </button>
        <button className="devkit-btn" disabled={!dirty} onClick={() => setColours(saved)} title="Put every colour back to what's saved">
          {CAN_SAVE ? 'Undo unsaved' : 'Undo changes'}
        </button>
        {status && <p className={`devkit-status is-${status.kind}`} role="status">{status.text}</p>}
        {copyFallback && <textarea className="ct-copy" readOnly value={copyFallback} onFocus={(e) => e.target.select()} />}
      </footer>
    </>
  )
}
