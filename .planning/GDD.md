# Glyphtender — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Discover   ·   Engineering plan: TDD.md (not yet)   ·   Milestones, ideas, known issues: ROADMAP.md (not yet)
> **Remake** of the Unity game (`../glyphtender-original`). Everything known about the original: `research/original-digest.md`. References + directions: `research/discovery.md`.

## 1. Pitch
- **One line:** *The Glyphtender's Trial* — hunt your rivals' glyphlings across a hex garden, walling them in with the letters you cast, and spell words for points along the way. **An area-control game with a spelling element, not a spelling game with area control.**
- **Platform:** web — phone (portrait **and** landscape) + desktop, one responsive layout system. PWA so it installs.   **Audience:** general (not made for kids) · board-gamers and word-game players, 2–4 at one table or online.
- **References** (breakdowns in `research/discovery.md`): Game of the Amazons (move, then shoot from where you landed; lose when you can't move — the skeleton of our turn and end), Hive (surround to win, hex board on a phone), Santorini (two-step move-then-build turn UX), Scrabble GO / Wordfeud (rack + board on a phone, live word score), board-game apps' pass-and-play and responsive layouts.

## 2. Experience targets  (rough — /define locks them)
| | Target | In players' words | We'll know when… (watchable) | Seen? |
|---|---|---|---|---|
| Primary | Challenge — cunning | "I trapped them AND scored with the same move" | players pause to look for double-duty moves; groans/cheers at a tangle | — |
| Secondary | Tension — hidden score | "Am I ahead…? I'll risk the self-tangle." | players self-tangle to end it; big reaction at the score reveal | — |
| Secondary | Fellowship — cozy table | "No, don't put the Z there!" | banter across the device in pass-and-play; asks for a rematch | — |
| Not this game | A vocabulary exam | — | a player with a small vocabulary can win by hunting | — |
**Key moments** (rough): the tangle · the double-duty cast · the end-of-game score reveal · stealing someone's half-built word.
**Watch-outs:** turns feel like homework (hunting through the rack) · board too small to read on a phone · waiting while others think in pass-and-play · opening lockout (the snake draft exists to prevent it).

## 3. Pillars  (draft)
- **Hunt first, spell second** — area control decides games; words are the fuel. *Settles:* scoring never gets multiplier squares that turn it into Scrabble.
- **Always readable** — whose turn, what's legal, what just happened, at a glance on a phone in either orientation. *Settles:* the board gets the space; everything else collapses around it.
- **A cozy garden, not a spreadsheet** — soft, bubbly, satisfying; pauses so everyone follows each move. *Settles:* animate the cast rather than snapping tiles.
- **Every seat is swappable** — human here, human online, or an AI with a personality; the rules don't care. *Settles:* pass-and-play first, built so AI and online plug into the same seat.

## 4. How it plays
Same rules as the original (with its rule bugs fixed) — full rules in `research/original-digest.md §1`; moved here in /define.
- **Core loop:** move a glyphling → cast a runeblossom from where it landed → score words through it → draw or refresh → … until two glyphlings are tangled → reveal scores.

## 5. Systems
Pass-and-play (first) · AI opponents with personalities (next — also the first framework AI module) · online rooms (after; reuse Roll Better's PartyKit rooms) · stats (the Wordsmith/Tanglesmith radar is designed but was never shown).

## 6. Look & sound
UI: Muzzy's Game UI kit, **Cozy** style. Board art from the original (vine-wrapped letters in rounded hexes, fuzzy leaf-sprout glyphlings) — to be judged at web size. Signature cast idea: seed arcs to the hex → buried → glyphling splashes magic water → letter grows like topiary.

## 7. Scope
Filled in /define. Muzzy's steer (2026-09-30): first release = **strong pass-and-play**; AI replaces a seat next; online "P0.5" (in if cheap); tutorial later.

## 8. Product
- **Release path:** web (GitHub Pages) first.   **Business:** none yet.
- **Success looks like:** friends ask to play again; Muzzy prefers it to the Unity version.

## 9. Open questions
- **Hands in pass-and-play**: hidden (needs a "pass to Blue" screen between turns) or open on the table? Hidden hands + hidden scores is a lot of secrecy for one device.
- **Hidden scores**: keep fully hidden, or add an optional "show scores" table setting?
- **Board size**: Small 85 / Large 117 / the original paper 92 — one per player count?
- **Tile bag**: adopt Muzzy's 120-tile bag with **Qu** (code had 98, no Qu)? Can it run out on the Large board with 4 players (117 hexes + 32 in hand > 120)?
- **Confirm vs undo**: keep preview → Confirm on every action, or free undo until you end the turn?
- **Word rule**: Muzzy's "union" rule for contained words vs the simpler "longest word per line" the code used.
- **Strategist personality**: multi-word specialist (code) or DENY-first tactician (HANDOFF)?
- **Look**: keep the dark starry art, or go lighter to suit Cozy? (Cozy kit + dark board may clash.)
