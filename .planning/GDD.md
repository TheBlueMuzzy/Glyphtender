# Glyphtender — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Define   ·   Engineering plan: TDD.md (not yet)   ·   Milestones, ideas, known issues: ROADMAP.md (not yet)
> **Remake** of the Unity game (`../glyphtender-original`). Everything known about the original: `research/original-digest.md`. References + directions: `research/discovery.md`. Direction chosen: **B — board-first modern** (same rules; flow and layout rebuilt to current board-game-app practice).

## 1. Pitch
- **One line:** Hunt your rivals' glyphlings across a hex garden — every letter you cast is a wall *and* a chance to spell.
- **In one breath:** Move a glyphling, cast a letter from where it lands. Letters score when they make words, but they also fence people in. Trap two glyphlings and the game ends; scores stay secret until the reveal. *An area-control game with a spelling element, not a spelling game with area control.*
- **Platform:** web — phone (portrait **and** landscape) + desktop, one responsive layout. Installable (PWA).   **Audience:** general (not made for kids) · board-gamers and word-game players, 2–4 around one device, later online.
- **References:** Game of the Amazons (our turn and ending skeleton) · Hive (surround to win, hex board on a phone) · Santorini (move-then-build turn, legal-move highlights) · Scrabble GO / Wordfeud (rack + board on a phone, live score on the commit button) · board-game apps for pass-and-play handoff, shape-based layouts, undo-until-commit, staged endings. Breakdowns in `research/discovery.md`.

## 2. Experience targets  (MDA — what players should feel; used by tuning and playtests)
| | Target | In players' words | We'll know when… (watchable) | Seen? |
|---|---|---|---|---|
| Primary | **Challenge — cunning** | "I boxed them in AND scored with the same letter." | players stop to hunt for double-duty casts; a tangle gets a groan or a cheer | — |
| Secondary | **Tension — the secret score** | "Am I ahead…? I'll tangle myself and end it." | players deliberately self-tangle to end the game; audible reaction at the reveal | — |
| Secondary | **Fellowship — around the table** | "Don't you dare put the Z there!" | banter during others' turns in pass-and-play; "again?" within a minute of the reveal | — |
| Not this game | **A vocabulary exam** | — | a player who spells short words can still win by hunting | — |
**Key moments:** the tangle · the double-duty cast · stealing someone's half-built word · the score reveal.
**Watch-outs:** turns that feel like homework (staring at the rack) · a board you can't read on a phone · waiting through others' turns · an opening lockout (the snake draft exists to prevent it) · the best speller always winning.

## 3. Pillars
- **Hunt first, spell second** — area control decides games; words fuel it. *Settles:* no multiplier squares or letter values — word = length + ownership. The AI hunts before it spells.
- **Always readable** — whose turn, what's legal, what just happened, at a glance, on a phone either way up. *Settles:* the board gets the space and always fits; everything else collapses around it; every legal option is highlighted.
- **Try freely, commit once** — you can experiment on the board without penalty until you cast. *Settles:* one commit per turn with undo (pending Muzzy's feel test, F01).
- **A cozy garden, not a spreadsheet** — soft, bubbly, satisfying; the game pauses so everyone can follow each move. *Settles:* animate casts and tangles; scores are revealed, not tallied in a corner.
- **Every seat is swappable** — local human, online human or AI personality; the rules don't care. *Settles:* pass-and-play is built on seats, so AI and online plug in without touching the rules.

## 4. How it plays
Same rules as the original, with its rule bugs fixed — full rules in `research/original-digest.md §1`; written here in the Design part.
- **Core loop:** move a glyphling → cast a runeblossom from where it landed → words through it score → draw or refresh → … until two glyphlings are tangled → the reveal.

## 5. Systems
Pass-and-play seats (first) · AI personalities (alpha — first framework AI module) · online rooms (beta — reuse Roll Better's PartyKit rooms) · stats + Wordsmith/Tanglesmith radar (beta). Detailed in the Design part.

## 6. Look & sound
UI: Game UI kit, **Cozy** style. Board art from the original to be judged at web size. Filled in the Design part with Muzzy.

## 7. Scope
Release stages: prototype → alpha → beta → 1.0. **Done** for a stage = all its musts done.

| Must — prototype (full pass-and-play) | Must — alpha (AI) | Must — beta (online) | Must — 1.0 | Should | Could | Won't (and why) |
|---|---|---|---|---|---|---|
| Rules engine with the original's bugs fixed (120-tile bag + Qu, discards return to the bag, union word rule) | AI framework module (goal-selection personalities, fuzzy perception, difficulty) | Online rooms: code, join, 2–4 players (Roll Better rooms) | Tutorial (progressive, first game) | Board themes | Async play (several games at once) | 2v2 teams — cut in the original as "less fun" |
| Responsive layout: phone portrait, phone landscape, desktop; board always fits | 7 personalities with bios + taunt lines | Rejoin, host leaves, AFK → AI takes the seat | Accessibility pass (colour-blind glyphling marks, 200% text) | Colour preference per player | Spectators | Multiplier squares / letter values — breaks *Hunt first* |
| Snake draft, move → cast turn with legal highlights, commit style from F01 | AI in any seat, 2–4 players (original was 2p only) | Rematch | Final art + audio pass | Random starting player (setting) | Leaderboards, accounts | Tilted 3D camera — breaks *Always readable* |
| Hand tray: tap and drag, reorder, shuffle, swap (refresh) mode | AI plays at human pace (animated, speed setting) | Stats + radar screen | Credits, privacy, PWA polish | Undo history beyond one turn | 3D figurine glyphlings | Per-step confirm (unless F01 says otherwise) |
| Live move score on the Cast button; words outlined | Cast + tangle animations ("bubbly") | | | Hint button ("show me a move") | Topiary-grow cast effect (might move up) | |
| Tangle danger cues; tangle + game end + tangle bonus | Basic audio | | | | | |
| Pass-and-play handoff screen (hidden hands) | End stats (per-player table) | | | | | |
| Staged score reveal (basic) | Settings: tap/drag, tray side, AI speed | | | | | |
| Main menu + new-game setup (players, board) — kit screens | | | | | | |
| Dev Kit (tuning), deploy to GitHub Pages | | | | | | |

## 8. Product
- **Release path:** web (GitHub Pages) first; stores later if it earns it.   **Business:** none yet.
- **Success looks like:** friends ask to play again; Muzzy prefers it to the Unity version; a full 4-player game on one phone never needs a zoom.

## 9. Open questions
- ❓ **Commit style** — one Cast + undo vs per-step confirm → decided by the **F01 feel test** (move → shoot → undo, no scoring).
- ❓ **Board size** — Small 85 / Large 117 / paper 92 — one per player count? Decide from AI-vs-AI sims once the engine exists (alpha); prototype ships Small + Large.
- ❓ **Bag run-out** — can 120 run out on Large with 4 players (117 + 32)? Sim. Original rule if it does: stop drawing.
- ❓ **Starting player** — Yellow always, or random? (original wished for random)
- ❓ **Strategist personality** — multi-word specialist (code) or DENY-first tactician (HANDOFF)? Settle in alpha.
- ❓ **Look** — keep the dark starry art, or lighter to suit Cozy? Design part, with Muzzy.
- **Risks** (and cheapest test):
  1. *Board unreadable on a phone* (117 hexes, landscape height ~360 px) → F01 renders both boards at 390×844, 844×390, 1440×900. Math says ~32–37 px hexes — enough for a letter.
  2. *The new commit flow feels wrong to Muzzy* → F01 feel test, before any of the turn flow is built on it.
  3. *AI too slow in a browser* (~10k candidate moves/turn) → run it in a Web Worker; time it in alpha.
