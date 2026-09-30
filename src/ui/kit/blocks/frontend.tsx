// FRONT END — MainMenu, ModeSelect, HowToPlay, Credits.
// Each one is a screen: open it with screens.push('…'), and Back / Esc close it.
// A button only appears when you pass its function (no onQuit → no Quit button).
import { useState, type ReactNode } from 'react'
import { Grid, Panel, Row, Screen, Stack } from '../layout'
import { Button, Card, Badge, ScrollArea, Text } from '../controls'
import { screens } from '../screens'
import { Pips } from './hud'
import { fill } from './words'

// MAIN MENU — the game's name, then its big buttons. The first one is the main (primary) one.
// Two ways to give the buttons:
//   items: your own list, in your order — [{ label: 'Play', onClick: play }, { label: 'Play online', onClick: online }].
//          primary: true marks the main button(s); if none is marked, the first one is.
//   or the named ones (onContinue, onPlay, onSettings…): shown in that fixed order. Ignored when items is given.
export const mainMenuWords = { continue: 'Continue', play: 'Play', settings: 'Settings', howToPlay: 'How to play', credits: 'Credits', quit: 'Quit' }
export type MainMenuItem = { label: string; onClick: () => void; primary?: boolean }
type MainMenuProps = {
  title: string; subtitle?: string; version?: string; children?: ReactNode // children: extra buttons
  items?: MainMenuItem[]
  onContinue?: () => void; onPlay?: () => void; onSettings?: () => void
  onHowToPlay?: () => void; onCredits?: () => void; onQuit?: () => void
  words?: Partial<typeof mainMenuWords>
}
export function MainMenu({ title, subtitle, version, children, items, words, ...on }: MainMenuProps) {
  const w = { ...mainMenuWords, ...words }
  const named = [
    [w.continue, on.onContinue], [w.play, on.onPlay], [w.settings, on.onSettings],
    [w.howToPlay, on.onHowToPlay], [w.credits, on.onCredits], [w.quit, on.onQuit],
  ].filter(([, onClick]) => onClick).map(([label, onClick]) => ({ label, onClick }) as MainMenuItem)
  const buttons = items ?? named
  const anyMarked = buttons.some((item) => item.primary)
  const isPrimary = (item: MainMenuItem, i: number) => (anyMarked ? item.primary : i === 0)
  return (
    <Screen label={title} bottom={version && <Text kind="caption">{version}</Text>}>
      <Stack gap="xl" className="kit-menu kit-main-menu kit-centred">
        <Stack gap="xs">
          <Text kind="display">{title}</Text>
          {subtitle && <Text kind="caption">{subtitle}</Text>}
        </Stack>
        <Stack gap="s" className="kit-main-menu-buttons">
          {buttons.map((item, i) => (
            <Button key={`${i}-${item.label}`} variant={isPrimary(item, i) ? 'primary' : 'secondary'} onClick={item.onClick}>{item.label}</Button>
          ))}
          {children && <div className="kit-main-menu-extra">{children}</div>}
        </Stack>
      </Stack>
    </Screen>
  )
}

// MODE SELECT — a card per mode (Solo, Party, Online…); pick one, then Start.
export const modeSelectWords = { title: 'Choose a mode', start: 'Start', back: 'Back' }
type Mode = { id: string; name: string; description?: string; badge?: string }
type ModeSelectProps = {
  modes: Mode[]; value: string; onChange: (id: string) => void; onStart: () => void
  onBack?: () => void; words?: Partial<typeof modeSelectWords>
}
export function ModeSelect({ modes, value, onChange, onStart, onBack = () => screens.pop(), words }: ModeSelectProps) {
  const w = { ...modeSelectWords, ...words }
  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-wide">
        <Text kind="title">{w.title}</Text>
        <Grid gap="m" min="s">
          {modes.map((mode) => (
            <Card key={mode.id} title={mode.name} selected={mode.id === value} onClick={() => onChange(mode.id)}>
              {mode.description && <Text kind="caption">{mode.description}</Text>}
              {mode.badge && <Badge variant="primary">{mode.badge}</Badge>}
            </Card>
          ))}
        </Grid>
        <Row gap="s" justify="end">
          <Button variant="ghost" onClick={onBack}>{w.back}</Button>
          <Button onClick={onStart}>{w.start}</Button>
        </Row>
      </Panel>
    </Screen>
  )
}

// HOW TO PLAY — pages you flip through (a title, a picture, a few lines each).
export const howToPlayWords = { title: 'How to play', next: 'Next', back: 'Back', done: 'Got it', page: 'Page {n} of {total}' }
type HowToPage = { title: string; body: ReactNode; image?: string }
export function HowToPlay({ pages, onDone = () => screens.pop(), words }: { pages: HowToPage[]; onDone?: () => void; words?: Partial<typeof howToPlayWords> }) {
  const w = { ...howToPlayWords, ...words }
  const [index, setIndex] = useState(0)
  const page = pages[index]
  const last = index === pages.length - 1
  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-modal">
        <Text kind="caption">{w.title}</Text>
        <Text kind="title">{page.title}</Text>
        {page.image && <img className="kit-picture" src={page.image} alt="" />}
        <Text>{page.body}</Text>
        <Row gap="s" justify="between">
          <Pips count={pages.length} filled={index + 1} label={fill(w.page, { n: index + 1, total: pages.length })} />
          <Row gap="s">
            {index > 0 && <Button variant="ghost" onClick={() => setIndex(index - 1)}>{w.back}</Button>}
            <Button onClick={() => (last ? onDone() : setIndex(index + 1))}>{last ? w.done : w.next}</Button>
          </Row>
        </Row>
      </Panel>
    </Screen>
  )
}

// CREDITS — the people, then every font/art/sound credit from the game's content/credits.json
// (pass the file's contents as `assets`). Entries without a credit line use author + licence.
export const creditsWords = { title: 'Credits', assets: 'Fonts, art & sound', back: 'Back' }
type CreditEntry = { credit?: string; author?: string; licence?: string; url?: string }
type CreditsProps = {
  people?: { role: string; names: string[] }[]; assets?: CreditEntry[]
  onBack?: () => void; words?: Partial<typeof creditsWords>
}
export function Credits({ people = [], assets = [], onBack = () => screens.pop(), words }: CreditsProps) {
  const w = { ...creditsWords, ...words }
  return (
    <Screen label={w.title}>
      <Panel depth={2} gap="m" className="kit-modal kit-tall">
        <Text kind="title">{w.title}</Text>
        <ScrollArea label={w.title}>
          <Stack gap="l">
            {people.map((group) => (
              <Stack key={group.role} gap="xs">
                <Text kind="heading">{group.role}</Text>
                {group.names.map((name) => <Text key={name}>{name}</Text>)}
              </Stack>
            ))}
            {assets.length > 0 && (
              <Stack gap="xs">
                <Text kind="heading">{w.assets}</Text>
                {assets.map((a, i) => <Text key={i} kind="caption">{a.credit ?? `${a.author}, ${a.licence}`}</Text>)}
              </Stack>
            )}
          </Stack>
        </ScrollArea>
        <Row justify="end"><Button variant="secondary" onClick={onBack}>{w.back}</Button></Row>
      </Panel>
    </Screen>
  )
}
