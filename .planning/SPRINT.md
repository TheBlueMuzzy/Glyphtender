# Sprint 04 — A full pass-and-play game
Started 2026-09-30 (autonomous — Muzzy asleep) · Milestone v0.3 · Features: F11, F14, F12, F13 (game) ∥ F16, F17 (framework Dev Kit tools)
Goal: 2–4 friends play a complete game on one phone — main menu → new game (players, board) → draft → turns with seeds kept secret between players → the Magic reveal → play again.
What Muzzy will see change: New game screen (2–4 players, board, 2-letter words), a "Pass to Blue" screen between turns, glyphlings close to tangled get a warning look, and a staged Magic reveal at the end. In the Dev Kit: Snapshots (save/restore any moment) and Bug capture. Stays the same: no online, no AI, no sound.

## F11 🧱 Seats + pass-the-device handoff
- [x] 🤖 1. Seats in the store: each seat local-human for now (the type allows online/AI later) — src/store/seats.ts
- [x] 🤖 2. Handoff screen between local players: "Pass to Blue" in their colour, board visible + dimmed, seeds hidden until tapped; skipped when "hide seeds" is off — src/game/Handoff.tsx

## F14 🎮 Menus
- [x] 🤖 3. New game screen (kit): players 2–4, board (Small / Large / default for player count), 2-letter words on/off, hide seeds on/off → Start — src/ui/newGame*.tsx
- [x] 🤖 4. Pause: Resume, Rules (short how-to-play from en.json), Settings, Leave game — kit screens

## F12 🎮 Tangle danger cues
- [x] 🤖 5. A glyphling with 0–1 moves left shows a warning look (same language: a thorny/dashed ring in its owner's colour, never scores) + a tangled look — src/game/Board.tsx, garden.json

## F13 🎮 Magic reveal + end table
- [ ] 🤖 6. Staged, skippable reveal (research/wordplay.md + references.md): tangle bonuses pop hex by hex (+3), then each total counts up lowest first, then the winner — src/game/Reveal.tsx, anim.json
- [ ] 🤖 7. End table: Magic, tangle Magic, best turn, longest word, words made; Play again / New game / Menu — src/game/GameOver.tsx

## F16 🔧 Dev Kit Snapshots (framework-first)  ∥  F17 🔧 Dev Kit Bug capture (framework-first)
- [ ] 🤖 8. Framework devkit: Snapshots tab (save / name / restore / delete moments; game supplies get/set state) + Bug capture (● record · 📍 mark · send → a file /bug can read: last ~60 s of actions, state, version, device) — dev/framework/devkit (branch dev/devkit-tools)
- [ ] 🤖 9. Install into Glyphtender + wire the game's adapter (engine state + action log) — src/devkit-game/

## Checks
- [ ] 🤖 10. e2e: a 3-player game with handoffs + new-game screen + reveal at 390×844, 844×390, 1440×900; nothing clipped; console clean — e2e/
- [ ] 🙋 11. Play 2–4 player pass-and-play on your phone; judge the handoff and the reveal (and Sprint 03's turn flow + night menus)
Check: npm test, build, check:ui, check:devkit, e2e:game + new e2e green; Claude looks at the screenshots first.

Ask Muzzy:
Notes:
- Task 1 (seats): src/store/seats.ts — a seat is local | online | ai + name + colour; the store holds seats (all local for now). Every tap goes through one question in the store, canPlay(): a game, no seed in the air, no handoff waiting, and the current seat is a local human on this device (online/AI seats plug in there). The store also keeps the table options (Play again reuses them) and the end table numbers (src/store/stats.ts: best turn, longest word, words made — gathered from each turn the engine reports; the rules never needed them). +11 tests.
- Task 2 (handoff): src/game/Handoff.tsx — kit Screen dialog (dims the garden, still visible) with a Panel: the next player's glyphling portrait ringed in their colour, "Pass to Blue", one cozy line, and a "Show my seeds" button in the player's colour (the Panel sets the kit's --primary to the player colour and --on-primary to the night background, so every player colour reads). Tall screens: the box sits over the tray at the bottom (more garden shows); wide: bottom right over the tray column. While waiting, the tray shows empty slots, the buttons are greyed and the turn bar says "Pass to Blue". The store decides when: after the draft (before turn 1), and whenever play passes to another local player — after a refresh, which the player who just played does first. After a throw the box waits growTime + wordGlowTime so everyone sees the move. Hide seeds off → never.
- Task 3 (new game): src/ui/NewGameScreen.tsx (kit Screen + Panel + ListRow rows with Stepper / Selector / Toggle, like the kit Settings screen; rows scroll on a phone on its side) + src/ui/newGame.ts (choices, remembered in localStorage under glyphtender:new-game — wrapped in try/catch, odd saved values fall back). Main menu Play → New game → Start. Changing the player count picks that count's default garden (boards.json defaultForPlayers); you can still pick the other. 2-letter words off = min word length 3 (the engine's own rule option). Play again reuses the game's options with a fresh random seed. +5 tests.
- Task 4 (pause): the kit Pause now has Back to the garden (resume) · Settings · Rules · Leave game (asks first). Rules = the kit HowToPlay: 3 short pages (Your turn · Words make Magic · A tangled garden, 7 lines of text) in en.json → game.rules.
- Task 5 (danger cues): src/store/danger.ts (engine legalMoves: 1 move = warning, 0 = tangled; none during the draft; +2 tests) drawn by src/game/DangerCue.tsx — warning = a dashed "thorny" ring at the hex edge in the owner's colour; tangled = a curly vine (wavy ring + 3 leaves) and the glyphling fades a little. Everyone's glyphlings, from the committed board (a planned-but-not-cast move doesn't change them; a held/planned glyphling shows its held/planned ring instead). Numbers in garden.json: warningWidth, warningDash, vine, vineWidth, tangledDim. Dev hook: __glyphtender.playUntilDanger(seed) fast-forwards to a position with a warning.
