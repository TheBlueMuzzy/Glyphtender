# End screen research (2026-10-01)

Brief (Muzzy): the scores are the biggest thing, then a breakdown (solo-word points, how many 2/3/4/5/6+ letter words, tangle points, seeds refreshed, multi-word turns), maybe a score graph with tangle dots, up to 4 players, maybe the winner in the middle, plus "interesting moments". The old table was "confusing, cluttered, cramped" and didn't point out anything interesting.
What exists now: `Reveal.tsx` (staged count-up, lowest score first, tangle +3s pop on the board) leads to `GameOver.tsx` (rows inside a ScrollArea, with one grey stats line each: tangles, best turn, longest word, words made). `src/store/stats.ts` keeps only bestTurn, longestWord and wordsMade.

> How sure is this? Web search turned up very little about how these screens are actually laid out. The game-by-game notes below are partly my own knowledge of the games, not something I checked. The firm facts: BGA splits end stats into a table-wide set and a per-player set ([BGA docs](https://en.boardgamearena.com/doc/Game_statistics:_stats.inc.php)), and its players got confused by a breakdown written in rule shorthand ("4/5/6/7 with a white apple") until a clear final score sheet was added ([BGA forum](https://forum.boardgamearena.com/viewtopic.php?t=29692)). Terraforming Mars digital players on Steam have asked for a score-over-generations graph that the game doesn't have ([Steam](https://steamcommunity.com/app/800270/discussions/0/3267933887508752183)). Mario Party hands out 2–3 bonus stars at the end, and in later games they're picked at random from a pool ([MarioWiki](https://www.mariowiki.com/Star_(Mario_Party_series))). Wordfeud counts "highest move" (all words made in one go) separately from "highest word" ([Wordfeud blog](https://blog.wordfeud.com/2013/04/10/wordfeud-statistics/comment-page-1/)). Datawrapper and others say to label each line directly on phone charts and to design at 360–390 px first ([Depict Data](https://depictdatastudio.com/directly-labeling-line-graphs/), [PlotSet](https://plotset.com/blog/your-chart-breaks-on-the-phone-where-most-people-read-it)). Kahoot's final screen is a top-3 podium ([Mobbin](https://mobbin.com/explore/screens/6e2ca5f6-11a2-4c22-a61a-71a724d4eee5)).

## 1. What works, and what clutters

**Works**
- **Count the score up in stages, then settle it** (Wingspan, Ticket to Ride, Azul digital). Each category adds onto the bar as you watch, so the breakdown *is* the drama. Glyphtender already does this with the Reveal, so the end screen only needs to show the result, not re-tell it.
- **A scorecard with the same rows for every player** (BGA, Wingspan): the same stat on each line, one column per player. Easy to compare. It breaks down when the labels are written in rule shorthand.
- **The best moment, not just totals** (Wordfeud "highest move" vs "highest word", Scrabble GO bingos). People remember turns, not sums.
- **Awards at the end** (Mario Party bonus stars, Jackbox credits). A short title plus a reason ("Most words in one cast") gives every player something to be named for, which helps Fellowship. Mario Party's lesson: bonus stars that *change the winner* feel random and unfair, so our awards are for fun and never add Magic.
- **Hidden history shown at the end.** People asked for a score-over-time graph in Terraforming Mars because the race was hard to see while playing. For us, with Magic kept secret, the graph is the payoff of the whole game: "you were ahead the whole time and nobody knew".
- **Summary first, details one tap away** (Hearthstone and Snap results show win/loss big, details behind). Kahoot uses a podium for the top 3 and a list for the rest.

**Clutters**
- Everything on one screen at the same size (the current table plus its grey stats line).
- A scroll box inside a dialog on a phone (the current ScrollArea), which hides rows you didn't know existed.
- Labels written in rule shorthand, or numbers with no "out of what".
- A chart legend you have to match colours against; more than 4 lines; full gridlines and tick marks.
- Long animations you can't skip (Ticket to Ride players complain). Ours already has Skip; keep it.
- Awards that call someone the worst at something (e.g. "fewest words"). Never name the loser for being bad.

## 2. Recommended layout (phone portrait, 390×844)

Three pages you swipe sideways, with tabs at the top (**Results · Story · Scorecard**) and the **Menu / New game** buttons pinned at the bottom on every page. Nothing scrolls inside a box; at most the whole page scrolls.

**Page 1: Results (what you see first)**
- Title: "Grand Glyphtender: Yellow!"
- **Winner, centred and big:** glyphling art (~120 px), name, Magic in the biggest type on the screen. Under it, a thin bar split into **Words** and **Tangles** colours, with the two numbers. That's the first breakdown at a glance.
- **Everyone else in one row underneath**, as equal cards ordered 2nd, 3rd, 4th from left to right: small art, place, name, Magic, and the same thin split bar. 3 cards × ~115 px fits at 390 px.
- **Highlights:** 3 award cards (section 3), one line each, with the player's colour chip. Tapping one jumps to that moment on the Story chart.

**About "winner in the middle"**, weighed honestly: the Olympic 2-1-3 podium reads well for exactly 3 players, and Kahoot-style apps have taught people to read it. But at 390 px with 4 players, the 2-1-3-4 order makes you work out who came where, and ties make it worse. A winner in the middle can't sit exactly centred with 4 columns either. **Recommendation:** keep Muzzy's idea that the winner sits centred and biggest, but put the winner *above* the others instead of between them. That works the same for 2, 3 and 4 players:
- **2 players:** winner big, the other player as one card underneath. A side-by-side duel layout is also fine.
- **3 or 4 players:** winner big, then 2 or 3 cards in place order.
- **Landscape and desktop:** there's room for the real 2-1-3 podium (or 3-1-2-4, built with a centred row) with the Story chart beside it. Worth trying there.

**Ties**
- **Shared win:** two (or more) winners side by side at the same hero size, under the title "Shared win!". If 3 or more share it, shrink the heroes, never the title.
- **Lower ties:** the same place number ("=2nd") and the same card style, ordered by seat.

**Page 2: Story (one swipe)**
The Magic-over-time chart (section 4). Tap any marker to see what happened under the chart: "Round 7 · Blue cast N: GARDEN + DEN, +14".

**Page 3: Scorecard (two swipes)**
One row per stat, one column per player (a ~110 px label column plus 4 × ~65 px columns fits). Each player's column has a colour chip at the top. The best number in each row gets a soft tint, which does what the old grey line couldn't: it shows where each player was strongest. Rows, in groups:
- **Magic:** Total · From words · *of which solo words* · From tangles
- **Words:** 2-letter (shown only when the table plays with 2-letter words allowed) · 3 · 4 · 5 · 6+ · Longest word · Best turn
- **Play:** Multi-word turns · Seeds refreshed · Tangled others · Got tangled

## 3. Highlights: Glyphtender-specific awards (they never add Magic)
> **Superseded 2026-10-02 (TDD D54):** these awards were all replaced by 14 skill awards (positioning & blocking first), earned only, shown one at a time in a carousel with a star on the Story chart — see GDD §4 Highlights. Kept here as the history of the idea.

| # | Award (working name) | What it means | Data needed |
|---|---|---|---|
| 1 | **The deciding turn** | the last time the lead changed hands; the winner never trailed after it | running totals after every turn |
| 2 | **Biggest turn** | most Magic in one cast | turn.magic, words |
| 3 | **Two birds** | most words grown from one seed | words.length per turn |
| 4 | **Longest word** | longest word grown | word lengths |
| 5 | **Borrowed bloom** | the most Magic from a word made mostly of *other* players' seeds | who owned each seed in each word |
| 6 | **Generous gardener** | whose seeds gave rivals the most letters (a friendly tease) | who owned each seed, per word, compared with who cast it |
| 7 | **Solo grower** | the most Magic from words made only of your own seeds | who owned each seed |
| 8 | **Knot tier** | who tangled whom: the player whose turn trapped a rival's glyphling | glyphlings newly tangled after each turn + whose turn it was |
| 9 | **Brave knot** | tangled their own glyphling to end the game, and the gamble worked (or didn't) | the game-ending turn, tangled glyphlings and their owners, final ranks |
| 10 | **Tangle harvest** | biggest tangle bonus received | the end tangle bonus per player |
| 11 | **Secret leader** | led for the most rounds while nobody could see it | running totals per round |
| 12 | **Comeback** | the biggest gap the winner closed | running totals |
| 13 | **Photo finish** | won by 3 Magic or less (this table-wide award replaces others when it happens) | final totals |
| 14 | **Rare seed** | the best word using Qu, Z, X or J | letters in each word, its Magic |
| 15 | **Fresh start** | the most Magic made on the turn after a refresh | refresh flag, the next turn's Magic |

**Which ones show by default (3, or up to 4 with 4 players):** start with **Deciding turn** (or **Photo finish** when it applies). Then fill the slots in this order: **Biggest turn, Two birds (only for 2+ words), Borrowed bloom, Knot tier or Brave knot, Tangle harvest, Comeback (only if the gap was 10+), Secret leader, Longest word**, then the rest. **Give no player two awards until every player has one** (Fellowship: in a 4-player game everyone gets a moment). Skip awards that don't apply (no word with 2+ seeds borrowed means no Borrowed bloom). All the thresholds go in `content/tuning/endscreen.json`.

## 4. The Magic-over-time chart

- **What it shows:** cumulative Magic for each player, with one point per **round** (after everyone has had a turn), so 4 players doesn't mean 4× the jagged points. One line per player in their glyphling colour.
- **The last step is labelled "Tangles":** the end tangle bonus jumps up in its own shaded column on the far right, drawn as a dotted segment. You can *see* when the tangles swung the result, which backs up *the best speller doesn't always win*.
- **Markers (no more than about 6 on the whole chart):**
  - a knot icon where a glyphling got tangled, on the owner's line at that round, outlined in the tangler's colour
  - a small star on each highlighted award turn
  - a faint tick where the lead changed
  - Each marker gets a tap area of at least 44 px (pass-and-play fingers). Tapping shows the caption under the chart, never a floating tooltip.
- **Readable on a phone:**
  - ~358 × 220 px
  - **Direct labels** at each line's right end (avatar dot + final total), nudged apart when they collide. No legend.
  - 2–3 faint horizontal guide lines; x labels only for "R1", the last round and "Tangles"
  - 3 px lines
  - Purple and pink are close, so also give each player a different end-dot shape (circle, square, triangle, diamond), or dashed lines, for colour-blind players.
- **Draws itself in left to right** once, ~1.5 s, when the page opens (instant with reduce motion on). It's a mini replay of the secret race.
- The dataviz skill has the rules for marks and colours when this gets built.

## 5. What the engine must record each turn (add to `TurnSummary` or a separate game log)

The current `TurnSummary` has seat, glyphlingId, from/to, letter, target, words (word, hexes, magic) and drew. **Add:**
1. `turnNo` and `round` (draft turns don't count)
2. `refreshed`: how many seeds were set aside on a refresh turn (0 if none). `drew` alone mixes up drawing after Magic with refilling to 8.
3. For each word: `owners[]`, the seat that owned each seed in reading order (needed for solo words, Borrowed bloom, Generous gardener, the +1 per own seed), and `ownMagic`, the part that came from owned seeds.
4. `totalsAfter[]`: everyone's Magic after this turn. This drives the chart, lead changes, the deciding turn and Comeback, and costs nothing to compute.
5. `tangledAfter[]`: the glyphling ids that are tangled after this turn, plus `newlyTangled[]` and `freed[]`, so we know who trapped whom, and when.
6. `moveOnly`: true when the player could move but not cast (it already shows as `letter: null`; just confirm).
7. **When the game ends:** `endedOnTurn`, `endedBy` (seat), `selfTangle` (did the last mover tangle their own glyphling?), and for each tangled glyphling its owner plus the bonus each other player got from it, with how many of their pieces were next to it (the Reveal already works this out in `revealPlan.ts`, so save it rather than computing it twice).

Keep the log beside the game (like `stats.ts`), not in the rules. **Online:** it holds the secret running totals, so the screen must only read it once the game is over (or the server sends it at the end), or the Secret-Magic tension leaks out.
