# Glyphtender — Bugs
Open: 6 (P0 0 · P1 0 · P2 1 · P3 5)
## Open
### B001 · P3 · open · found 2026-09-30 in F05 · v0.0.0 · word list data
ZYGOTES isn't a word; "ZYGOTESAA" is
Steps: play ZYGOTES · Expected: scores · Actual: not in the list; the list has `ZYGOTESAA,0.00` instead.
Cause: the original's "+218 missing words" commit (8522a373, 2025-12-22) appended "AA…" to a file whose last line (ZYGOTES) had no newline, gluing them together. AA itself is also in the list (AA,4.01), so only ZYGOTES is lost.
Fix waiting on Muzzy (precious data — never changed without his OK): split the line into `ZYGOTES` (Zipf from the original 5353eaca list, or 0.00) and drop the duplicate AA. Related question: the list ends with 7 later additions — AIDS, AWOL, CHINA, FRENCH, JAPAN, MOROCCO, ROMAN (proper nouns/abbreviations the cleanup removed elsewhere) — keep?
### B002 · P2 · open · found 2026-09-30 in F09 · v0.0.0
If the word list fails to load, Cast / End turn just waits — no message, no retry
Steps: go offline before the first load, start a game, plan a turn · Expected: a friendly "Couldn't load the words — retry" · Actual: button stays waiting. (The installed app caches the list, so this mostly hits a first visit on a bad connection.) End turn also waits for the list on a move-only turn, which it doesn't need.
### B003 · P3 · open · found 2026-09-30 in F10
Tapping a non-glowing hex in the draft logs a console warning ("Illegal action from the screen"); the player sees nothing. Fix: check legal draft hexes before sending.
### B004 · P3 · open · found 2026-09-30 in F08
Dragging a seed only to reorder the tray (mid-turn, after a move) leaves it picked up with gold hexes lit, and cancels an existing aim. Design question: should a reorder drag drop the selection?
### B005 · P3 · open · found 2026-09-30 in F09
A right-click counts as a tap. / Tapping Results early then closing it within 1.5 s lets the timer reopen it (rare).
### B006 · P3 · open · found 2026-09-30 in F16
Dev Kit snapshots don't carry the end-table stats or table options — a restored game's end table only counts turns played after the restore.
## Fixed (newest first)
### (F13) · verified 2026-09-30 · fixed in "F13: fix side column shrinking during the reveal" · Guarded by: e2e/pass-and-play-shots.mjs (column width turn vs reveal + long-name prompt, 844×390 & 1440×900) — side column shrank to the reveal's chips, turn-bar prompt ran off screen
### (F13) · verified 2026-09-30 · fixed in dbbe5bc · Guarded by: src/store/revealPlan.test.ts — two +3s drawn on one hex (read as +3, was +6)
### (F16) · verified 2026-09-30 · fixed in 430f07c · Guarded by: src/devkit-game/glyphtenderAdapter.test.ts — restore left menus stuck on top
### (F09) · verified 2026-09-30 · fixed in 95b34eb · Guarded by: e2e + finger-id tracking — a second finger hijacked a drag (floating piece stuck)
### (F09) · verified 2026-09-30 · fixed in b82cb97 — results dialog opened twice
### (F04) · verified 2026-09-30 · fixed in 3a1bbe2 · Guarded by: src/engine/tangle.test.ts — stuck turn when tanglesToEnd ≥ 3
