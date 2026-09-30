// PASS THE DEVICE — between two players on one device, when "hide seeds" is on: "Pass to Blue" in Blue's
// colour, over the garden (still visible, dimmed). The tray stays hidden until Blue taps "Show my seeds".
// The store decides WHEN (store.handoff — after the draft, and whenever play passes to another local player,
// after any refresh). This screen only waits for a thrown seed to finish growing (and its score pops to finish),
// so everyone sees the move.
// Kit parts only: Screen (dialog = dims what's under it), Panel, Avatar, Text, Button.
import { useEffect, useState, type CSSProperties } from 'react'
import text from '../../content/text/en.json'
import { useGameStore } from '../store/gameStore'
import { landingSeconds } from '../store/wordMarks'
import { Avatar, Button, Panel, Screen, Text, fill, reduceMotion } from '../ui/kit'
import { colourOf, glyphlingArt } from './art'
import { playerName } from './prompt'
import { useAnimTuning, useGardenTuning } from './useTuning'

const w = text.game.handoff

/** stacked: the tall layout — the box sits over the (hidden) tray, so more of the garden shows. flipped: the tray is
 *  on the other side (Settings → Tray position), so the box is too. */
export function Handoff({ stacked, flipped }: { stacked: boolean; flipped: boolean }) {
  const handoff = useGameStore((s) => s.handoff)
  const showSeeds = useGameStore((s) => s.showSeeds)
  const timing = useAnimTuning()
  const colours = useGardenTuning()

  // After a throw, wait until the runeblossom has grown and its words' border and score pops are done
  // (reduce motion: just long enough to read the turn's total, if it shows)
  const [ready, setReady] = useState<typeof handoff>(null)
  useEffect(() => {
    if (!handoff) return
    const { game, options } = useGameStore.getState()
    const pops = (options?.wordIndicators ?? true) && (game?.lastTurn?.words.length ?? 0) > 0
    const seconds = !game || !handoff.afterGrow ? 0
      : reduceMotion() ? (pops ? timing.scoreTotalHold : 0)
      : landingSeconds(game, pops, timing)
    const wait = seconds * 1000
    const timer = setTimeout(() => setReady(handoff), wait)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff])
  if (!handoff || ready !== handoff) return null

  const player = playerName(handoff.seat)
  const colour = colours[colourOf(handoff.seat)]
  // The button wears the player's colour, with dark words on it so every player colour reads
  const box = (
    <Panel depth={2} gap="m" className="kit-modal kit-centred" style={{ '--primary': colour, '--on-primary': colours.background } as CSSProperties}>
      <span><Avatar name={player} src={glyphlingArt(handoff.seat)} color={colour} active /></span>
      <Text kind="title">{fill(w.title, { player })}</Text>
      <Text>{fill(w.message, { player })}</Text>
      <Button onClick={showSeeds}>{w.show}</Button>
    </Panel>
  )
  // Over the tray: tall screens at the bottom (flipped: the top); wide at the bottom right (flipped: bottom left)
  const label = fill(w.title, { player })
  if (stacked) return flipped ? <Screen dialog label={label} top={box} /> : <Screen dialog label={label} bottom={box} />
  return flipped ? <Screen dialog label={label} bottomLeft={box} /> : <Screen dialog label={label} bottomRight={box} />
}
