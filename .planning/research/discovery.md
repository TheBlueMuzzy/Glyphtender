# Discovery — Glyphtender web remake (2026-09-30)

Inputs: `original-digest.md` (what the Unity game is), `references.md` (7 reference breakdowns + 15 UX recommendations, with sources; word-app UI claims tagged [known] need a hands-on check).

## What the references taught us (MDA-style, one line each)
| Reference | Feel → Do → Rule | Steal | Avoid |
|---|---|---|---|
| **Game of the Amazons** | dread of being boxed in → players wall off regions → move then shoot from where you landed; can't move = lose | it *is* our skeleton. AI: judge positions by "who reaches each hex first" + mobility; mobility early, territory late; count reachable **moves**, not hexes (sealed regions are often "defective") | — |
| **Hive / Santorini apps** | tactical clarity → players scan legal moves → highlight every legal option at every step | legal-move highlights per step, flat readable board | Santorini's tilted camera (mis-taps); Hive's drifting board you have to chase |
| **Scrabble GO / Wordfeud / WWF** | "ooh, +23" → players try tiles and watch the score bubble → live pending-word score | bottom tray + action row, live score on the commit button, swap as an in-tray mode, drag *and* tap | red "invalid word" errors (our casts don't need to make words) |
| **Pass-and-play apps** (TtR, Carcassonne, BGA hotseat) | fair secrecy → players look away at handoff → "pass to X" screen | handoff screen in the next player's colour; board stays visible, only the hand hides | forcing it when nothing is secret |
| **Responsive board-game apps** (lichess, chess.com, Wingspan, BGA) | the board is the game → board gets max space | choose layout by the **shape** of the screen (tall → stack, wide → side tray), board auto-fits | layouts chosen by device type (lichess foldable bug); Wingspan crowding |
| **Undo conventions** (Root/Dire Wolf, BGA) | freedom to try → players experiment → free undo until new info is revealed | one commit per turn; undo until "Cast" (drawing reveals info) | per-step confirm (the Unity build ~doubles taps per turn) |
| **Hidden-score endings** (TtR, Wingspan) | the gasp at the end → scores stay private → staged reveal | tangle bonuses pop one by one, totals count up lowest-first, skippable | end bonuses that "flash by too fast" |

## Where the Unity version differs from industry practice
1. Confirm on every step (move, cast) → industry: one commit per turn, free undo before it.
2. Tilted 3D camera with pinch/pan as the main way to see the board → industry: flat board that always fits; zoom only as an extra.
3. One layout scaled by hand-tuned margins → industry: pick layout by screen shape.
4. No legal-cast preview scores; hidden-score tension relies on memory → industry: live score on the commit button (move only, never totals) + show *danger* (glyphlings with 0–1 moves) instead of scores.
5. No pass-and-play handoff → hands visible to everyone on one device.
6. Engine-side rule bugs (discards vanish, 98-tile bag, no Qu, word-containment rule) — see digest §1.

## Directions (not picked — /define chooses)
- **A. Faithful + fixed.** Same rules and flow (per-step confirm), bugs fixed, Cozy kit UI, 2D board. Lowest risk; keeps what Muzzy already knows works, keeps the clunkiness too.
- **B. Board-first modern.** Same rules; the flow and layout rebuilt to industry practice: shape-based layout, flat always-fit board, one commit per turn with free undo, live move-score on the Cast button, handoff screens, danger cues, staged reveal. *Hunch: this is the one — it answers "clunky" and "space" directly without touching the game's soul.*
- **C. Tabletop 3D.** R3F table like Roll Better, figurine glyphlings, tilted camera. Charming, reuses Roll Better tech, but fights the space/readability goal and costs phone performance.
- **D. B + rules polish.** B, plus small rule experiments tested by AI-vs-AI sims once the engine exists: board size per player count, 120-tile bag with Qu, optional visible scores.

## Hunches worth checking later (engine sims, not Python)
The rules engine will be pure TypeScript with tests, so sims can run AI-vs-AI games directly instead of a separate proto:
- Can the 120 bag run out on the Large board with 4 players (117 hexes + 32 in hand)? How long do games run per board size × player count?
- Does first player (Yellow always starts) have an edge? (The original wished for a random starting player.)
- How often do games end by self-tangle?

## Architecture hunch (for /define's TDD — not decided)
Rules as a pure `(state, action) → state` engine shared by client and (later) PartyKit server. A "seat" is human-local, human-online or AI; all three just submit actions. Pass-and-play first proves the engine + seats; AI and online plug in without touching the rules. The AI becomes a framework module: engine-agnostic personality/goal/perception core + game-specific goal scorers.
