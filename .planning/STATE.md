## ▶ RESUME HERE
AUTONOMOUS (Muzzy asleep, 2026-09-30): Sprints 02 + 03 done — engine, word list, UI kit, and a playable 2-player game (menu → Play). Sprint 04 — A full pass-and-play game (F11 handoff, F14 menus, F12 danger, F13 reveal ∥ F16/F17 Dev Kit tools in the framework, branch dev/devkit-tools). Status board = SPRINT.md.
Muzzy: play a 2-player game (dev server → Play) and judge the turn flow · look at the night menus · answer Ask Muzzy in archive/sprints/sprint-02.md + sprint-03.md.

## Where we are
Stage: develop · Milestone: v0.2 Plant a garden · Sprint: 04 · Doing: F11 + F16 · Branch: dev/alpha · Version: 0.0.0 · Live: none yet

## Key facts
**Remake.** Web remake of the Unity game. The original is read-only reference at `../glyphtender-original` (GitHub `TheBlueMuzzy/glyphtender-original`, renamed from `Glyphtender` 2026-09-30). Never copy it wholesale — pull ideas/assets across deliberately. Digest: `.planning/research/original-digest.md`.
**AI source of truth** is the original's branch `festive-booth` (goal-selection model), not its `main`.
**Muzzy's direction (2026-09-30):** phone (portrait AND landscape) + desktop — do responsive properly · first release = strong pass-and-play (AI replaces a seat next; online = "P0.5", reuse Roll Better's rooms if cheap) · tutorial not yet · UI kit **Cozy** style · think critically vs industry standards, don't just port.
**BMUZ stress test:** log BMUZ gaps in `~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md` as we go.
**Default branch:** main. Work branch: `dev/alpha`.
**Sims:** `npm run sim` (research/sims.md): bag runs out in 0–1.6% of games; games 42–67 turns.
**Run:** `npx vite --host --port 5180` (dev port 5180) · tests `npm test` · sketch check `npm run e2e:sketch` (needs the dev server).

## Log
- 2026-09-30 — Sprint 03 done (autonomous): playable 2-player game — board, real-size tray, draft, turn flow + throw, basic results; review fixed 2 bugs.
- 2026-09-30 — Sprint 02 done (autonomous): rules engine (84 tests, 6,000 sim games), official word list byte-for-byte, Magic + refresh, UI kit Cozy night. Word Play researched.
- 2026-09-30 — Sprint 01 done: skeleton (Vite/React/TS, Dev Kit, PWA, Pages workflow), art, F01 prototype approved + throw story.
- 2026-09-30 — /define done: theme (Grand Glyphtender, Magic), cozy not hunting, alpha = pass-and-play + online, beta = AI. Official word list traced + kept. TDD + roadmap.
- 2026-09-30 — Project created (remake). Old repo/folder renamed to glyphtender-original. /discover done: digest, references, directions.
