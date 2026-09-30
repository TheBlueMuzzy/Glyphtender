# Ghost pieces — showing a "planned, not placed" seed that stays solid AND readable (B010)

2026-09-30 · for B010 (reopened). Muzzy: *"the ghost letter isn't really legible due to contrast reasons. maybe there's a better way than to just push the values towards white?"*

## The problem, measured

A seed is read by one thing: its letter is much **brighter** than the dark tile behind it. Hue (gold, cyan, pink, purple) says who owns it; **luminance** makes it legible. The WCAG contrast ratio measures exactly that brightness gap (4.5 = body text, 3 = large text / icons).

`node scripts/planned-contrast.mjs` measures it on all 104 seed pictures: letter = the brightest 25% of the tile's middle, tile = the darkest 40%, the ratio of their median luminances, with each look's maths copied from its SVG filter.

| look | median | worst | how it changes the picture |
|---|---|---|---|
| real seed | **6.7** | 5.0 | — |
| misty (old default) | **2.0** | 1.8 | pale wash over everything: the dark tile rises a lot, the letter hardly at all, so the gap closes |
| greyed | 2.9 | 2.1 | darkens everything: the gap shrinks with it |
| dimmed | 2.4 | 2.1 | the tile's navy mixed into everything |
| **moonlit** (new) | **9.1** | 6.5 | brightness kept, colour removed, remapped dark navy → moon-white |
| **stencil** (new) | **12.0** | 11.4 | two flat colours: letter/border pale, tile dark |

So Muzzy's hunch is right: any treatment that mixes one colour evenly over the whole piece (a wash, a fade, transparency) *must* shrink the letter's contrast, because it pulls the letter and the tile toward the same colour. WebAIM says the same of transparency: lowering alpha lets another colour bleed in and lowers contrast. The fix is to change **colour, texture or outline** while keeping (or widening) the **brightness gap**.

## How others show a pending piece

- **Tetris Guideline — ghost piece**: allowed as "a Tetrimino outline or a translucent ghost image". Tetris pieces carry no text, so translucency costs nothing there; for a *lettered* piece it is exactly what hurt us. The outline option is the relevant lesson: change the drawing style, not the opacity. ([Hard Drop wiki](https://harddrop.com/wiki/Ghost_piece), [TetrisWiki guideline](https://tetris.wiki/Tetris_Guideline))
- **Chess premoves (lichess, chess.com)**: the pieces are never faded — the *squares* get a distinct colour (lichess: grey/blue premove squares). State is shown around the piece, the piece stays fully readable. Our pulsing halo is this idea already. ([lichess forum](https://lichess.org/forum/lichess-feedback/can-we-get-option-to-change-move-highlight-colour), [chess.com help](https://support.chess.com/en/articles/8562432-what-are-pre-moves-and-how-do-they-work))
- **Word games (Scrabble GO, Words With Friends)**: tiles you've laid but not played stay full-strength and readable; "pending" is shown by a lighter tile face / a live score bubble, never by fading the letter. (Observed convention; [WWF rules](https://zyngasupport.helpshift.com/hc/en/63-words-with-friends-2/faq/10552-words-with-friends-rule-book/).)
- **Builders — placement holograms** (Satisfactory's build gun, The Forest, Islanders): the preview is the *same model in a different material* — a single-hue hologram with edge glow and scanlines. The shape stays readable because the lighting/brightness structure is kept; only the colour/material changes. ([Satisfactory wiki](https://satisfactory.wiki.gg/wiki/Build_Gun), [Unity discussions](https://forum.unity.com/threads/ghost-building-script.256786/), [hologram shader](https://www.youtube.com/watch?v=peY9VipZ74o))
- **Carcassonne (digital)**: possible spots take the player's colour; the tile itself is shown normally. ([tsaglam/Carcassonne](https://github.com/tsaglam/Carcassonne/releases))
- **Design tools / drag and drop** (Figma, Atlassian): a ghost is usually semi-transparent — fine for boxes, but Atlassian and Pencil & Paper stress the drop preview must still say exactly *what* lands *where*. ([Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop), [Atlassian](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines))
- **Accessibility**: WCAG 1.4.3/1.4.11 contrast is a *luminance* ratio (hue changes are free); WCAG 1.4.1 says colour alone must not carry state — pair it with shape, pattern or motion. ([W3C 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html), [W3C 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html), [WebAIM contrast](https://webaim.org/articles/contrast/))
- **SVG technique**: a *gradient map* (duotone) — greyscale with feColorMatrix, then feComponentTransfer `table` maps dark→colour A, light→colour B — keeps the brightness structure while replacing all colour. ([Codrops](https://tympanus.net/codrops/2019/02/05/svg-filter-effects-duotone-images-with-fecomponenttransfer/), [CSS-Tricks](https://css-tricks.com/using-svg-to-create-a-duotone-image-effect/))

## Candidates

1. **Moonlit (gradient map, colourless)** — the seed in moonlight-silver: dark parts → deep navy, bright parts → moon-white, a little brightness lift. *Not yet placed*: every real seed is vividly coloured, so a colourless one reads as a spirit/ghost of the seed at a glance (player colour moves to the halo). *Legibility*: 9.1, better than a real seed. *Fit*: moonlight suits the night garden and sits calmly under the pulsing halo. *Cost*: 2 filter steps.
2. **Stencil / blueprint cut-out** — two flat colours, letter + border pale on a plain dark tile (luminance threshold, soft edge). *Not yet placed*: reads as a plan or paper cut-out (the "outline" branch of the Tetris ghost). *Legibility*: 12.0, the highest. *Fit*: loses the painted texture — cleaner but less cozy; a bit jagged at the edge on phones. *Cost*: 3 steps.
3. **Desaturate but keep brightness** (greyscale, no darkening) — like moonlit without the cool tint or the lift; measured 6.3 (worst 4.1), a touch under a real seed. Reads more "disabled" than "ghost".
4. **Hatching / stipple on the tile only** — diagonal lines masked to the dark areas ("under construction"). Clear state, but hatch lines lift the tile's average brightness and add noise at 40 px. Mask + pattern: medium cost.
5. **Hologram scanlines / shimmer** — moving lines over the art. Strong "preview" language in builders, but a second motion on top of the pulsing halo is busy, and reduce-motion needs a fallback.
6. **Dark tile, full-colour letter** — keep the letter, darken the tile more. Very legible, but too close to a real seed.
7. **Seed/sprout badge + letter** — an extra icon: needs new art, crowds a small hex.

## Recommendation

**Moonlit** as the default: it's a clear change of *colour* (colourless vs coloured) that keeps, and slightly widens, the brightness gap that makes the letter readable, keeps the art's vines and sparkle, and together with the pulsing halo in the player's colour it meets "colour is never the only signal". **Runner-up: stencil** — the most legible and most "planned/blueprint", but it flattens the painting. Both are solid (no alpha change: nothing on the board shows through). Tuning in `garden.json` (plannedMoon*, plannedStencil*); the old looks stay selectable.
