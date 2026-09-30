# Glyphtender — Roadmap
Release target: alpha (pass-and-play + online) — musts 4/21 done
IDs are names, not build order — follow `needs:`.

## v0.1 — Sketch  ✅ done 2026-09-30
Goal: Muzzy moves a glyphling, casts a seed, undoes, and does it again — on his phone both ways up and on desktop — and decides how committing a turn should feel.
- ✅ F02 🧱 Project skeleton — must:alpha · sprint 1
  what: Vite + React + TS, vitest, GitHub Pages deploy, PWA, phone-on-Wi-Fi dev link, Dev Kit (Console, Tuning, Color)
- ✅ F01 ❓ Prototype: move → cast → undo (code sketch) — must:alpha · needs: F02 · sprint 1
  answer: One Cast + undo; throw story + one halo style for planned pieces (GDD §4, TDD D08)
  what: both boards, night mood, stand-in art, tap + drag, undo / tap-again, a "Cast" button; no scoring, no turns. Lives in `sketches/`, thrown away after.
  why: answers *Try freely, commit once* and *Always readable* (can you read 117 hexes on a phone?) before the turn flow is built on them
```mermaid
flowchart LR
  F02[✅ F02 Skeleton] --> F01[✅ F01 Prototype]
```

## v0.2 — Plant a garden  ← current  (→ alpha)
Goal: two players on one device draft, move, cast, grow words and make Magic on either board.
- 🎛️ F03 🧱 UI kit (Cozy, night colours) — must:alpha · needs: F02 · sprint 2
- ✅ F04 🧱 Rules engine: boards, draft, move/cast legality, bag (120 + Qu), tangles, game end, tangle bonus — must:alpha · needs: F02 · sprint 2
- ✅ F05 🧱 Official word list + word finder (union rule, Qu, min length) — must:alpha · needs: F02 · sprint 2
- ✅ F06 🧱 Magic + draw / refresh — must:alpha · needs: F04, F05 · sprint 2
- 🟢 F07 🧱 Board view + layout shell (tall → stacked, wide → side tray; fit / zoom) — must:alpha · needs: F01, ~F03, F04
- ⏳ F08 🎮 Seed tray (tap + drag, reorder, shuffle, refresh mode) — must:alpha · needs: F07
  why: seeds always in reach, refresh never a dead turn → avoids "homework" turns
- ⏳ F09 🎮 Turn flow (legal highlights, move, cast, undo, "Cast · +N", words outlined, throw + sprout, piece-state look from F01) — must:alpha · needs: F01, F06, F07, F08
  why: every legal option lit + live Magic preview → players hunt for two-birds casts → Cozy cleverness
- ⏳ F10 🎮 Snake draft — must:alpha · needs: F07, F04
  why: fair openings, no lockout → Fellowship
```mermaid
flowchart LR
  F04[✅ F04 Engine] --> F06[✅ F06 Magic]
  F05[✅ F05 Word list] --> F06
  F03[🎛️ F03 Kits] --> F07[🟢 F07 Board + layout]
  F04 --> F07
  F01[✅ F01 Prototype] --> F07
  F07 --> F08[⏳ F08 Seed tray]
  F06 --> F09[⏳ F09 Turn flow]
  F07 --> F09
  F08 --> F09
  F01 --> F09
  F07 --> F10[⏳ F10 Draft]
  F04 --> F10
```

## v0.3 — A full pass-and-play game  (→ alpha)
Goal: 2–4 friends play a complete game on one phone, from the main menu to the Magic reveal, without seeing each other's seeds.
- ⏳ F11 🧱 Seats + "pass to Blue" handoff screen — must:alpha · needs: F09
  why: seeds stay secret on one device → Fellowship without peeking; seats let online + AI plug in later
- ⏳ F12 🎮 Tangle danger cues — must:alpha · needs: F09
  why: shows risk instead of scores → Secret-Magic tension stays, board stays readable
- ⏳ F13 🎮 Magic reveal + end table + play again — must:alpha · needs: F09
  why: staged reveal (bonuses pop, totals count up lowest-first) → the gasp at the end → Secret-Magic tension
- ⏳ F14 🎮 Menus: main, new game (players, board, 2-letter), settings, pause — must:alpha · needs: F03, F11
- ⏳ F15 ✨ Grow + move animations (basic) — must:alpha · needs: ~F09
  why: a pause to see what grew → *A cozy garden*, everyone follows the move
- 🟢 F16 🔧 Dev Kit Snapshots — save/restore any board position (framework-first) — must:alpha · needs: F03, F04
- 🟢 F17 🔧 Dev Kit Bug capture (framework-first) — must:alpha · needs: F03
```mermaid
flowchart LR
  F09[⏳ F09 Turn flow] --> F11[⏳ F11 Seats + handoff]
  F09 --> F12[⏳ F12 Danger cues]
  F09 --> F13[⏳ F13 Reveal]
  F09 -.-> F15[⏳ F15 Animations]
  F11 --> F14[⏳ F14 Menus]
  F03[🎛️ F03 Kits] --> F14
  F03 --> F16[🟢 F16 Snapshots]
  F04[✅ F04 Engine] --> F16
  F03 --> F17[🟢 F17 Bug capture]
```

## v0.4 — Play online  (→ alpha release)
Goal: 2–4 players on different devices join by room code and play a full game; seeds and Magic stay secret.
- 🟢 F18 🧱 Framework "rooms" module — harvested from Roll Better (create/join, identity, rejoin, host migration) — must:alpha
- ⏳ F19 🧱 Online server: same engine, per-player views (`design/online.md` first) — must:alpha · needs: F11, F18
- ⏳ F20 🎮 Create / join a room, 2–4 players (kit Lobby) — must:alpha · needs: F19, F14
  why: play with friends anywhere → Fellowship
- ⏳ F21 🎮 Rejoin, host leaves, idle players — must:alpha · needs: F20
- ⏳ F22 🎮 Rematch — must:alpha · needs: F20, F13
```mermaid
flowchart LR
  F18[🟢 F18 Rooms module] --> F19[⏳ F19 Server]
  F11[⏳ F11 Seats] --> F19
  F19 --> F20[⏳ F20 Lobby]
  F14[⏳ F14 Menus] --> F20
  F20 --> F21[⏳ F21 Rejoin / idle]
  F20 --> F22[⏳ F22 Rematch]
  F13[⏳ F13 Reveal] --> F22
```

## Later
- **beta (AI):** framework AI module from the original's goal-selection model (`research/original-digest.md §2`) · 7 personalities with bios + gentle banter · AI in any seat, 2–4 players, online idle takeover · AI at human pace + speed setting · Dev Kit AI tool (AI-vs-AI, personality sliders) · basic audio · sims: board size per player count, bag run-out, first-player edge · ❓ AI vocabulary tiers (Zipf 3/2/0 vs 4/3/0) · ❓ Strategist personality
- **1.0:** tutorial · accessibility pass · Muzzy's final art + board art · audio pass · stats screen + Wordsmith/Tanglesmith radar · credits + privacy · ❓ word list licence (keep + permission, or re-run the Zipf pipeline on a free base)
- **Should:** board themes · colour preference · random starting player · hint · topiary-grow cast effect
- **Could:** async play · spectators · leaderboards/accounts · 3D figurine glyphlings

## Ideas
- 2026-09-30 — Magic sparkles that pop against the night garden (Muzzy)
- 2026-09-30 — Signature cast: seed arcs → buried → glyphling splashes magic water → topiary letter grows (from the original's HANDOFF §11.2)
- 2026-09-30 — Harvest candidates for the framework once proven here: seed tray (tile rack), hex board viewport (fit/zoom), drag-to-slot
