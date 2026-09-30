## ▶ RESUME HERE
Sprint 06 "Feel pass" done (autonomous, 2026-09-30): all of Muzzy's playtest notes built — score pops → total over the caster, word indicators option (white border behind words), gold cast hexes right after the move, drop-target highlight, turn pulse, "no" shake, finger-sized buttons, prompt above the tray, Tray position setting, end screen = New game. Alpha feature-complete on dev/alpha; nothing deployed. Next: Muzzy plays → approvals → `/deliver` alpha.
**Muzzy — list:**
1. Play again (`npm run dev` → http://192.168.1.152:5180; online also `npm run party:dev`). Feel check: pops, word borders, pulse, shake, drop target, big buttons, flipped tray (Settings → Gameplay). Every timing is in Dev Kit → Tuning.
2. Sprint 06 questions (defaults built): indicators OFF hides "+N" + pops too? · desktop buttons 83 px — keep or cap? · tall phones: prompt sits between board and tray (can't also halve that gap) OK? · empty hexes don't shake, no pulse in the draft OK?
3. Earlier decisions (defaults built): Magic only as secret as a real table · online timer Off, dropped player 60 s → auto-play, leaver auto-played, 2 missed turns = away, rematch/New game = host · word list B001 (ZYGOTESAA + 7 proper nouns) · refresh near an empty bag.
4. Framework: merge branch dev/rooms (Dev Kit 0.3.0, Rooms 0.1.1, UI kit 0.2.5) into main.
5. Roll Better (live) leaks players' persistentIds (BMUZ finding 39).
6. BMUZ stress test: 45 findings in ~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md.

## Where we are
Stage: develop · Milestone: v0.4 Play online · Sprint: — · Doing: waiting on Muzzy (play + decisions, then /deliver alpha) · Branch: dev/alpha · Version: 0.0.0.2 · Live: none yet

## Key facts
**Remake.** Web remake of the Unity game. The original is read-only reference at `../glyphtender-original` (GitHub `TheBlueMuzzy/glyphtender-original`, renamed from `Glyphtender` 2026-09-30). Never copy it wholesale — pull ideas/assets across deliberately. Digest: `.planning/research/original-digest.md`.
**AI source of truth** is the original's branch `festive-booth` (goal-selection model), not its `main`.
**Muzzy's direction (2026-09-30):** phone (portrait AND landscape) + desktop — do responsive properly · first release = strong pass-and-play (AI replaces a seat next; online = "P0.5", reuse Roll Better's rooms if cheap) · tutorial not yet · UI kit **Cozy** style · think critically vs industry standards, don't just port.
**BMUZ stress test:** log BMUZ gaps in `~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md` as we go.
**Default branch:** main. Work branch: `dev/alpha`.
**Sims:** `npm run sim` (research/sims.md): bag runs out in 0–1.6% of games; games 42–67 turns.
**Online dev:** `npm run party:dev` (PartyKit on port 1997 — Roll Better uses 1999) + `npm run dev`; e2e: `e2e:game`, `e2e:pass`, `e2e:online` (each starts its own servers; run one at a time).
**Run:** `npx vite --host --port 5180` (dev port 5180) · tests `npm test` · sketch check `npm run e2e:sketch` (needs the dev server).

## Log
- 2026-09-30 — Sprint 06 Feel pass (autonomous): Muzzy's 11 playtest notes built + 7 bugs fixed by e2e and review; 197 tests.
- 2026-09-30 — Bug sweep (autonomous): word-list failure now shows Retry (and End turn no longer waits for words), draft ignores illegal taps quietly, right-click no longer taps, snapshots keep end-table stats. 168 tests, all e2e green.
- 2026-09-30 — Sprint 05 done (autonomous): move glide, rooms framework module (harvested from Roll Better), online server with per-player views, online seats, lobby, e2e:online (0 leaks); security review fixed 5 issues; layout fix for the reveal.
- 2026-09-30 — Sprint 04 done (autonomous): seats + handoff, new game screen, pause/rules, danger cues, staged Magic reveal, end table; Dev Kit 0.3.0 Snapshots + Bug capture (framework branch). Review fixed 2 bugs.
- 2026-09-30 — Sprint 03 done (autonomous): playable 2-player game — board, real-size tray, draft, turn flow + throw, basic results; review fixed 2 bugs.
- 2026-09-30 — Sprint 02 done (autonomous): rules engine (84 tests, 6,000 sim games), official word list byte-for-byte, Magic + refresh, UI kit Cozy night. Word Play researched.
- 2026-09-30 — Sprint 01 done: skeleton (Vite/React/TS, Dev Kit, PWA, Pages workflow), art, F01 prototype approved + throw story.
- 2026-09-30 — /define done: theme (Grand Glyphtender, Magic), cozy not hunting, alpha = pass-and-play + online, beta = AI. Official word list traced + kept. TDD + roadmap.
- 2026-09-30 — Project created (remake). Old repo/folder renamed to glyphtender-original. /discover done: digest, references, directions.
