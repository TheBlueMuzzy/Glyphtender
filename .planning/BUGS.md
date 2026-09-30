# Glyphtender — Bugs
Open: 2 (P0 0 · P1 0 · P2 0 · P3 2)
## Open
### B001 · P3 · open · found 2026-09-30 in F05 · v0.0.0 · word list data
ZYGOTES isn't a word; "ZYGOTESAA" is
Steps: play ZYGOTES · Expected: scores · Actual: not in the list; the list has `ZYGOTESAA,0.00` instead.
Cause: the original's "+218 missing words" commit (8522a373, 2025-12-22) appended "AA…" to a file whose last line (ZYGOTES) had no newline, gluing them together. AA itself is also in the list (AA,4.01), so only ZYGOTES is lost.
Fix waiting on Muzzy (precious data — never changed without his OK): split the line into `ZYGOTES` (Zipf from the original 5353eaca list, or 0.00) and drop the duplicate AA. Related question: the list ends with 7 later additions — AIDS, AWOL, CHINA, FRENCH, JAPAN, MOROCCO, ROMAN (proper nouns/abbreviations the cleanup removed elsewhere) — keep?
### B004 · P3 · open · found 2026-09-30 in F08
Dragging a seed only to reorder the tray (mid-turn, after a move) leaves it picked up with gold hexes lit, and cancels an existing aim. Design question: should a reorder drag drop the selection?
## Fixed (newest first)
### B006 · P3 · verified 2026-09-30 · fixed in b5478b7 · Guarded by: src/devkit-game/glyphtenderAdapter.test.ts ("B006: …" ×2) — Dev Kit snapshots now carry the end table stats + table options; older snapshots without them still restore
### B005 · P3 · verified 2026-09-30 · fixed in e30f2c2 · Guarded by: e2e/game-shots.mjs (desktop: right/middle click picks nothing up · closed end table stays closed for 2 s, Results reopens it) — right-click counted as a tap (usePieceInput now ignores non-main buttons). The "results reopen" half couldn't be reproduced: the 1.5 s timer it came from was removed when F13's reveal replaced it; the e2e keeps it from coming back
### B003 · P3 · verified 2026-09-30 · fixed in 200ca9b · Guarded by: src/store/gameStore.test.ts ("B003: …") — a tap/drop on a non-glowing draft hex logged "Illegal action from the screen"; now checked against the legal draft hexes and ignored
### B002 · P2 · verified 2026-09-30 · fixed in 4bbfb56 · Guarded by: src/store/wordsLoading.test.ts — word list failing to load left Cast / End turn waiting. Now: a toast "Couldn't load the words — tap Retry", the Cast button becomes Retry (fetches again), the turn bar says so; End turn (move only) never waits for the words
### (F13) · verified 2026-09-30 · fixed in "F13: fix side column shrinking during the reveal" · Guarded by: e2e/pass-and-play-shots.mjs (column width turn vs reveal + long-name prompt, 844×390 & 1440×900) — side column shrank to the reveal's chips, turn-bar prompt ran off screen
### (F13) · verified 2026-09-30 · fixed in dbbe5bc · Guarded by: src/store/revealPlan.test.ts — two +3s drawn on one hex (read as +3, was +6)
### (F16) · verified 2026-09-30 · fixed in 430f07c · Guarded by: src/devkit-game/glyphtenderAdapter.test.ts — restore left menus stuck on top
### (F09) · verified 2026-09-30 · fixed in 95b34eb · Guarded by: e2e + finger-id tracking — a second finger hijacked a drag (floating piece stuck)
### (F09) · verified 2026-09-30 · fixed in b82cb97 — results dialog opened twice
### (F04) · verified 2026-09-30 · fixed in 3a1bbe2 · Guarded by: src/engine/tangle.test.ts — stuck turn when tanglesToEnd ≥ 3
