# Glyphtender — Game Design Document (GDD)
> What the game is, how it plays, how it should feel. Aim for ~150 lines — detail lives in `design/` docs linked from here.
> Current phase: Complete   ·   Engineering plan: TDD.md   ·   Milestones, ideas, known issues: ROADMAP.md
> **Remake** of the Unity game (`../glyphtender-original`). The original: `research/original-digest.md`. References + directions: `research/discovery.md`. Direction: **B — board-first modern** (same rules; flow and layout rebuilt to current board-game-app practice).

## 1. Pitch
- **Theme:** You're competing to become the next **Grand Glyphtender**. Command your glyphlings to plant **runeblossom seeds** in the **Glyphwood Gardens**. Seeds grow into topiary shaped like letters; when letters form words they create **Magic**. Create the most Magic to prove you can keep magic alive in the Glyphwood!
- **Catchphrase:** ***The best speller doesn't always win.***
- **One line:** A cozy hex-garden game — move a glyphling, cast a seed, grow words into Magic; but where your garden grows matters as much as what it spells.
- **Platform:** web — phone (portrait **and** landscape) + desktop, one responsive layout. Installable (PWA).   **Audience:** general (not made for kids) · board-gamers and word-game players, 2–4 around one device or online.
- **References:** Game of the Amazons (turn + ending skeleton) · Hive (hex board on a phone, pieces hemmed in) · Santorini (move-then-build turn, legal-move highlights) · Scrabble GO / Wordfeud (rack + board on a phone, live score on the commit button) · board-game apps for handoff, shape-based layout, undo-until-commit, staged endings. `research/discovery.md`.

## 2. Experience targets  (MDA)
| | Target | In players' words | We'll know when… (watchable) | Seen? |
|---|---|---|---|---|
| Primary | **Cozy cleverness** (Challenge, gentle) | "That seed made a word *and* left their glyphling nowhere to go." | players pause to look for a cast that does two things; a smile or groan when a glyphling gets tangled | — |
| Secondary | **Secret-Magic tension** | "Am I ahead…? I'll tangle myself and end it." | someone deliberately self-tangles to end the game; audible reaction at the reveal | — |
| Secondary | **Fellowship** | "Don't you dare plant a Z there!" | banter during others' turns; "again?" within a minute of the reveal | — |
| Not this game | **A vocabulary exam** · **a combat game** | — | a short-word speller still wins sometimes; nobody talks about "attacking" | — |
**Key moments:** a glyphling gets tangled · the two-birds cast · growing someone else's half-word into yours · the Magic reveal.
**Watch-outs:** turns that feel like homework (staring at the seeds) · a board you can't read on a phone · waiting through others' turns · an opening lockout (the snake draft prevents it) · the best speller always winning.

## 3. Pillars
- **The best speller doesn't always win** — where you plant matters as much as what you spell. *Settles:* no multiplier squares or letter values (word = letters + ownership); tangle bonuses stay big; AI personalities that don't spell well can still win.
- **A cozy garden** — nobody is attacked: seeds grow, and glyphlings get *tangled* in the growing garden. *Settles:* wording ("tangled", never "trapped/killed"), soft animations, gentle AI banter (beta) — even the Bully is mischievous, not mean.
- **Always readable** — whose turn, what's legal, what just grew, at a glance, on a phone either way up. *Settles:* the board gets the space and always fits; every legal option is highlighted.
- **Try freely, commit once** — experiment on the board without penalty until you cast. *Settles:* one commit per turn with undo — **confirmed by the F01 prototype** (Muzzy, 2026-09-30: "it's better for sure").
- **Every seat is swappable** — local player, online player or AI; the rules don't care. *Settles:* pass-and-play is built on seats, so online and AI plug in without touching the rules.

## 4. How it plays
- **Core loop:** move a glyphling → cast a seed from where it landed → it grows → words make Magic → draw or refresh → … until two glyphlings are tangled → the Magic reveal.
- **Rules** (numbers live in `content/`, not code):
  1. **Board** — flat-top hex garden with 3 **leylines** (N–S, NE–SW, NW–SE; no horizontal). Small 85 hexes, Large 117. Default: Small for 2 players, Large for 3–4 (❓ sims may change it).
  2. **Setup** — each player has 2 glyphlings (Yellow, Blue, Purple, Pink). **Snake draft** (1-2-2-1 · 1-2-3-3-2-1 · 1-2-3-4-4-3-2-1): place on a non-edge hex not next to another glyphling. Then everyone draws 8 seeds from the bag.
  3. **Bag** — 120 seeds: A9 B2 C3 D4 E16 F3 G2 H6 I9 J1 K2 L5 M3 N7 O9 P2 **Qu1** R6 S7 T10 U4 V1 W3 X1 Y3 Z1. **Qu** is one seed, counts as one letter.
  4. **Move** — one of your glyphlings, ≥1 hex along a leyline. Can't pass through or land on anything.
  5. **Cast** — from where it landed, plant one seed along any leyline, any distance, on an empty hex. It may fly over your own seeds and glyphlings, not other players'.
  6. **Grow** — (words = the **official Glyphtender word list**, 63,656 words with Zipf scores, carried over unchanged — TDD §2b) every word through the new seed, on every leyline, makes Magic = **letters + 1 per seed you own in it**. Shared letters count in each word. On one leyline, a word hidden inside the other words made this turn doesn't count (GARDENING, not DEN; SEAL + LEAP, not ALE). Words read top-to-bottom / left-to-right. Min length 2 (table option: 3).
  7. **Draw or refresh** — made Magic → draw 1. Made none → you may set aside any number of seeds, refill to 8, then return the set-aside seeds to the bag.
  8. You must move and cast if you can. Can move but can't cast (no seeds, no open hex) → just move.
  9. **Tangled** — a glyphling with no legal move. Checked fresh after every turn, so a glyphling hemmed in by another glyphling is freed if that one moves away (as the original). When a turn ends with **2 or more glyphlings tangled**, the game ends.
  10. **Tangle bonus** — for each tangled glyphling, every *other* player gains **+3 Magic per seed or glyphling of theirs next to it**. Self-tangling next to your own seeds gives your rivals nothing.
  11. **Magic is secret** until the end. Most Magic wins; ties share the win.
- **Controls** (proven in the F01 prototype): tap-tap *and* drag, always both (phone and mouse).
  1. Tap/drag a glyphling → hexes it can reach glow teal → tap/drop one: it moves, leaving a faded ghost where it started (tap the ghost to send it back).
  2. Tap/drag a seed → hexes it can reach glow gold → tap/drop one: the seed sits there **faded** — targeted, not planted (tap it to take it back). **Undo** takes back the last step.
  3. **Cast** commits the turn — only then does the story play: the glyphling hops and **throws** the seed, it **arcs** to the target, lands, and the runeblossom **grows** out of the ground. Nothing can be touched while a seed is in the air.
  - Pinch/scroll zoom is optional; a Fit button snaps back.
- **Seed tray size:** seeds in the tray are **real size — the same as a seed on the board** (Muzzy, 2026-09-30: "they were way too small on my desktop… they should be basically real size to how they'll look on the board"). Never smaller than a finger (44 px); if a phone can't fit 8 at board size, the tray wraps to 2 rows rather than shrinking.
- **Piece states — one look for every piece** (glyphlings, seeds, tray): **options** = glowing hexes with a dot (teal move · gold cast) · **held** = solid ring in the player's colour · **planned** = pulsing halo at the hex edge in the player's colour (a targeted seed is also faded) · **done** = plain.
- **Mechanics:**
| Mechanic | What players end up doing → Target |
|---|---|
| Move then cast from the landing spot | reading two steps ahead: where to stand so the seed does double duty → Cozy cleverness |
| Seeds block movement (anyone's) | planting to hem in, and to build safe pockets for yourself → Cozy cleverness |
| Magic = letters + 1 per own seed | growing/stealing half-words on the board; ownership beats long words → *best speller doesn't always win* |
| Refresh only when you made no Magic | a bad hand still plants a wall — no dead turns → avoids "homework" |
| Secret Magic + game ends at 2 tangles | self-tangle gambles; guessing who's ahead → Secret-Magic tension |
| Tangle bonus +3 per adjacent piece | planning *where* a glyphling gets tangled, not just whether → Cozy cleverness |
| Snake draft | fair openings, no lockout → Fellowship |
**Trap check (predictions, to verify with AI-vs-AI sims in beta):** best speller dominates → countered by ownership +1 and tangle bonuses · runaway leader → hidden Magic blunts kingmaking · first-player edge (Yellow always starts) → sim; random start is a Should · 4-player waiting → fast turns, short animations, handoff screen.

## 5. Systems
- **Seats** — every player seat is *local*, *online* or *AI*; all submit the same actions to the same rules engine. Pass-and-play = several local seats + handoff screen (hand hidden, board visible).
- **Online (alpha)** — Roll Better's PartyKit rooms: room code, 2–4 players, rejoin, host leaves, AFK. Server runs the same rules engine, so it validates every move (the original never did).
- **AI (beta)** — the goal-selection personality model from the original's `festive-booth` branch (7 goals, 7 personalities, fuzzy Magic perception, difficulty) → built as the **first framework AI module**, game-specific goal scorers stay in the game. Add Amazons-style "reachable moves" evaluation for garden pockets. Detail: `research/original-digest.md §2`; `design/ai.md` in beta.
- **Stats (1.0)** — per-game table at the end (alpha), lifetime stats + Wordsmith/Tanglesmith radar later.

## 6. Look & sound
- **Function first; look is secondary for now.** Muzzy (2026-09-30).
- **Night-time garden** — dark, so Magic sparkles *pop* when they come (sparkles: later).
- **UI:** Game UI kit, **Cozy** style, tuned to night colours in `content/ui/style.json` (Cozy's preset is light paper).
- **Art:** the original's runeblossom letters (A–Z × 4 colours) and glyphling portraits, used as-is as stand-ins. **Muzzy will redraw them** (he also has board art for later).
- **Signature moment (later):** seed arcs to the hex → buried → glyphling splashes magic water → letter topiary grows.
- **Sound:** none in alpha; basic audio in beta.

## 7. Scope
Releases: **alpha → beta → 1.0** (no "prototype" release — prototypes are code sketches, like F01). **Done** = all its musts done.

**Must — alpha (pass-and-play + online)**
- Rules engine (rules above, the original's bugs fixed) + dictionary
- Responsive layout: phone portrait, phone landscape, desktop; board always fits
- Snake draft; move → cast turn with legal highlights; commit style from F01
- Seed tray: tap + drag, reorder, shuffle, refresh mode
- Live Magic preview on the Cast button; words outlined as they grow
- Tangle danger cues; tangle, game end, tangle bonus
- Pass-and-play handoff screen; staged Magic reveal; end-of-game table
- Main menu, new-game setup, settings, pause — UI kit, Cozy
- Online rooms (Roll Better): create/join, 2–4, rejoin, host leaves, rematch
- Grow animation (basic), Dev Kit tuning, GitHub Pages + PWA

**Must — beta (AI)** — AI framework module · 7 personalities with bios and gentle banter · AI in any seat, 2–4 players, online AFK takeover · AI plays at human pace (speed setting) · basic audio · board-size / bag sims settle §9

**Must — 1.0** — tutorial (progressive, first game) · accessibility pass (colour-blind glyphling marks, 200% text, reduce motion) · final art + audio · stats screen + radar · credits, privacy

**Should** — board themes · colour preference · random starting player · hint ("show me a move") · topiary-grow cast effect (may move up)
**Could** — async play (several games at once) · spectators · leaderboards/accounts · 3D figurine glyphlings
**Won't** — 2v2 teams (cut in the original as "less fun") · multiplier squares / letter values (breaks *best speller doesn't always win*) · tilted 3D camera (breaks *Always readable*) · per-step confirm (F01 prototype: One Cast felt better)

## 8. Product
- **Release path:** web (GitHub Pages) first; stores later if it earns it.   **Business:** none yet.
- **Success looks like:** friends ask to play again; Muzzy prefers it to the Unity version; a 4-player game on one phone never needs a zoom.

## 9. Open questions
- ❓ **Board size per player count** — sims in beta; alpha ships Small + Large.
- ❓ **Bag run-out** — can 120 run out on Large with 4 players? Sim. If it does: stop drawing.
- ❓ **Starting player** — Yellow always, or random?
- ❓ **AI vocabulary tiers** — code thresholds (Zipf 3/2/0) give ~22k/~44k/63k words; the design said ~5k/~20k/all (would be 4/3/0). (beta)
- ❓ **Strategist personality** — multi-word specialist or DENY-first tactician? (beta)
- **Risks:** ~~board unreadable on phones~~ (F01: hexes 36–42 px on phones, both boards) · ~~undo flow feels wrong~~ (F01: approved) · AI too slow in a browser → Web Worker, timed in beta.
