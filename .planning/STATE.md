## ▶ RESUME HERE
AUTONOMOUS (Muzzy asleep, 2026-09-30): Sprints 02–04 done — a full 2–4 player pass-and-play game (menu → new game → draft → turns with handoff → danger cues → Magic reveal → end table) + Dev Kit Snapshots/Bug capture. Sprint 05 — Play online (local server): F15 move glide, F18 rooms module (framework branch dev/rooms), F19 server, F20 lobby. Status board = SPRINT.md.
Muzzy: play pass-and-play on your phone (dev server → Play) and judge turn flow, handoff, danger cues, reveal · look at the night menus · merge framework branch dev/devkit-tools (Dev Kit 0.3.0) when happy · answer Ask Muzzy in archive/sprints/sprint-02..04.md · deploying online is yours (/deliver).

## Where we are
Stage: develop · Milestone: v0.4 Play online · Sprint: 05 · Doing: F15 + F18 · Branch: dev/alpha · Version: 0.0.0 · Live: none yet

## Key facts
**Remake.** Web remake of the Unity game. The original is read-only reference at `../glyphtender-original` (GitHub `TheBlueMuzzy/glyphtender-original`, renamed from `Glyphtender` 2026-09-30). Never copy it wholesale — pull ideas/assets across deliberately. Digest: `.planning/research/original-digest.md`.
**AI source of truth** is the original's branch `festive-booth` (goal-selection model), not its `main`.
**Muzzy's direction (2026-09-30):** phone (portrait AND landscape) + desktop — do responsive properly · first release = strong pass-and-play (AI replaces a seat next; online = "P0.5", reuse Roll Better's rooms if cheap) · tutorial not yet · UI kit **Cozy** style · think critically vs industry standards, don't just port.
**BMUZ stress test:** log BMUZ gaps in `~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md` as we go.
**Default branch:** main. Work branch: `dev/alpha`.
**Sims:** `npm run sim` (research/sims.md): bag runs out in 0–1.6% of games; games 42–67 turns.
**Run:** `npx vite --host --port 5180` (dev port 5180) · tests `npm test` · sketch check `npm run e2e:sketch` (needs the dev server).

## Log
- 2026-09-30 — Sprint 04 done (autonomous): seats + handoff, new game screen, pause/rules, danger cues, staged Magic reveal, end table; Dev Kit 0.3.0 Snapshots + Bug capture (framework branch). Review fixed 2 bugs.
- 2026-09-30 — Sprint 03 done (autonomous): playable 2-player game — board, real-size tray, draft, turn flow + throw, basic results; review fixed 2 bugs.
- 2026-09-30 — Sprint 02 done (autonomous): rules engine (84 tests, 6,000 sim games), official word list byte-for-byte, Magic + refresh, UI kit Cozy night. Word Play researched.
- 2026-09-30 — Sprint 01 done: skeleton (Vite/React/TS, Dev Kit, PWA, Pages workflow), art, F01 prototype approved + throw story.
- 2026-09-30 — /define done: theme (Grand Glyphtender, Magic), cozy not hunting, alpha = pass-and-play + online, beta = AI. Official word list traced + kept. TDD + roadmap.
- 2026-09-30 — Project created (remake). Old repo/folder renamed to glyphtender-original. /discover done: digest, references, directions.
