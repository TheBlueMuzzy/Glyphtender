# Sprint 03 — Plant a garden (playable)
Started 2026-09-30 (autonomous — Muzzy asleep) · Milestone v0.2 Plant a garden · Features: F07, F08, F10, F09 (in this order)
Goal: from the main menu, two players on one device draft their glyphlings, then move, cast and grow real words into Magic until the garden tangles — on phone (both ways up) and desktop.
What Muzzy will see change: a **Play** button on the menu → a real game on the night garden. Stays the same: no pass-the-phone screen yet (both players see the tray), a simple end screen (the staged Magic reveal is F13), no online, no AI.

## F07 🧱 Board view + layout shell
Done when: the real board (engine state) fills its box in both layouts with the F01 look; whose turn and what to do is always visible.
- [x] 🤖 1. Game store: engine state, official word list loaded once, planned move/cast, selection, undo — src/store/gameStore.ts (+ test)
- [ ] 🤖 2. Board from the sketch, cleaned: SVG auto-fit, piece-state language (options / held / planned halo / done), ghost — src/game/Board.tsx
- [ ] 🤖 3. Layout shell by screen shape + turn bar (player colour, prompt) — src/game/GameScreen.tsx
- [ ] 🤖 4. Main menu "Play" → 2 players, Small board (until F14's new-game screen) — src/ui/menus.tsx

## F08 🎮 Seed tray
- [ ] 🤖 5. Tray seeds at real size (= on-board hex size, ≥ 44 px; wrap to 2 rows rather than shrink), tap + drag, reorder, shuffle — src/game/SeedTray.tsx
- [ ] 🤖 6. Refresh mode after a turn with no Magic: tap seeds to set aside → "Refresh N" / "Keep all" — src/game/SeedTray.tsx, store

## F10 🎮 Snake draft
- [ ] 🤖 7. Legal draft hexes glow; tap/drag to place; prompt shows whose pick and which one — store, Board, GameScreen

## F09 🎮 Turn flow
- [ ] 🤖 8. Engine highlights (legalMoves / legalCasts), move, cast, undo + tap-again, "Cast · +N" from previewTurn (this move only), planned words outlined — store, Board, GameScreen
- [ ] 🤖 9. Throw + sprout on Cast (timings from anim.json), state commits on landing, grown words glow briefly — Board
- [ ] 🤖 10. Basic game over: kit dialog "The garden is tangled", each player's Magic, Play again — src/game/GameOver.tsx
- [ ] 🤖 11. e2e: draft + turns + refresh + game over at 390×844, 844×390, 1440×900; nothing clipped; console clean — e2e/game-shots.mjs
- [ ] 🙋 12. Play a 2-player game on phone + desktop; also look at the night menus (from Sprint 02) and tweak colours in Dev Kit → Color if wanted
Check: `npm test`, build, check:ui, check:devkit, e2e green; screenshots look right to Claude first.

Ask Muzzy:
Notes:
- Tray seeds are real size (Muzzy 2026-09-30) — GDD §4 "Seed tray size".
- Task 1: store = `src/store/gameStore.ts` (Zustand) + pure helpers `src/store/turnPlan.ts`. The store never changes the game except by sending an engine action (checkAction first). Tray order is the screen's own (a list of hand indexes per seat) — the rules don't care; after a turn/refresh survivors keep their place and new seeds go last. The draft and refresh don't wait for the word list; only Cast does.
- Tuning: `layout.json` trayTileMax removed (tray = real size now), trayGap added; `garden.json` + purple/pink, wordOutlineWidth, grownGlowStrength; `anim.json` + pulseTime, wordGlowTime. The sketch's one use of trayTileMax became a plain 64 so it keeps its look.
