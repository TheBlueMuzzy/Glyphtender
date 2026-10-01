// SCREEN PREVIEWS — what a game hands the Dev Kit's Screens tab: a list of the screens that are normally
// gated (the end screen, a handoff, a lobby with 4 players…), each able to set itself up from sample data.
// The game writes the list in src/devkit-game/previews.tsx (export const previews: DevKitPreview[] = [...]).
//
// A preview never runs in the real game. It runs in a SANDBOX: a second copy of the game in a frame on top
// (its own stores, its own screen stack), with saves, network sends, sounds and history steps blocked
// (sandbox.ts). show() runs inside that frame, so it may fill the game's stores freely — they're the frame's.
import type { ReactNode } from 'react'

/** One version of a preview, e.g. { id: '3p', label: '3 players' }. */
export interface PreviewVariant {
  id: string
  label: string
}

/** What show() gets besides the variant: a few sandbox controls. */
export interface PreviewSandbox {
  /** The variant picked (the first one if the preview has variants and none was asked for). */
  variant: string | undefined
  /** Make GET requests whose address contains this text fail — e.g. a word list that "didn't load". */
  failRequests(urlPart: string): void
  /** Run this once the screen has drawn (for things that need the page up, like a focus or a scroll). */
  afterRender(run: () => void): void
}

export interface DevKitPreview {
  /** Stable and URL-safe, e.g. "end-table". */
  id: string
  /** What the list shows, e.g. "End table". */
  label: string
  /** A heading the list groups by, e.g. "End of game", "Online". */
  group?: string
  /** One short line under the name: what this shows and when the player normally sees it. */
  note?: string
  /** Versions of the same screen (2 / 3 / 4 players, host / guest…). The first is the default. */
  variants?: PreviewVariant[]
  /** Where it matters most — shown as a tag; 'phone' also opens it in the phone-sized frame. */
  hint?: 'phone' | 'desktop'
  /**
   * Runs in the sandbox frame before anything draws: put sample data in the game's stores and open the screen.
   * Return nothing to draw the game's normal app over that data, or a React tree to draw instead
   * (e.g. a screen without its live-connection component). May be async (loading a word list, say).
   */
  show(sandbox: PreviewSandbox): void | ReactNode | Promise<void | ReactNode>
}

/** The URL query that turns a page load into a preview frame: ?devkit-preview=<id>&variant=<id>. */
export const PREVIEW_PARAM = 'devkit-preview'
export const VARIANT_PARAM = 'variant'

/** The address of the sandbox frame for one preview: this same page, with only the preview's query. */
export function previewUrl(href: string, id: string, variant?: string): string {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PREVIEW_PARAM, id)
  if (variant) url.searchParams.set(VARIANT_PARAM, variant)
  return url.toString()
}

/** Which preview a frame's address asks for (null = this page is not a preview frame). */
export function readPreviewUrl(href: string): { id: string; variant: string | undefined } | null {
  const params = new URL(href).searchParams
  const id = params.get(PREVIEW_PARAM)
  return id ? { id, variant: params.get(VARIANT_PARAM) ?? undefined } : null
}

/** Groups in list order (first appearance), each with its previews. */
export function groupPreviews(previews: DevKitPreview[]): { group: string; previews: DevKitPreview[] }[] {
  const groups: { group: string; previews: DevKitPreview[] }[] = []
  for (const preview of previews) {
    const name = preview.group ?? 'Screens'
    let found = groups.find((g) => g.group === name)
    if (!found) groups.push((found = { group: name, previews: [] }))
    found.previews.push(preview)
  }
  return groups
}
