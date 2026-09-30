## ▶ RESUME HERE
Overnight (autonomous, 2026-09-30): Sprints 02–05 done — **alpha is feature-complete on branch dev/alpha**: engine + official word list, Cozy night UI, 2–4 player pass-and-play (draft, turns, throw, handoff, danger cues, Magic reveal, end table), online play on a local server (rooms module, lobby, rejoin, rematch, security-reviewed), Dev Kit Snapshots + Bug capture. 11 features wait on Muzzy's feel check (🎛️). Nothing deployed. Next: Muzzy plays → approvals → `/deliver` alpha.
**Muzzy — morning list:**
1. Play: `npm run dev` (http://192.168.1.152:5180) → Play (pass-and-play) · online: also `npm run party:dev`, then Play online on phone + PC. Judge: turn flow, handoff, danger cues, reveal (~8 s), menus (night colours — Dev Kit → Color).
2. Decide (defaults already built): Magic "secret" only as secret as a real table (words are public) OK? · online: timer Off (60/90/120 choices), dropped player 60 s then auto-play, leaver auto-played, 2 missed turns = away, rematch = host decides, 2 players on one device online = Won't · handoff shows before turn 1 even for the same player · end-table + resume-button wording.
3. Word list (B001): split the glued `ZYGOTESAA` back into ZYGOTES? keep AIDS/AWOL/CHINA/FRENCH/JAPAN/MOROCCO/ROMAN? · Refresh near an empty bag: keep "set aside after refill"?
4. Framework: merge branch dev/rooms (contains Dev Kit 0.3.0 + Rooms 0.1.1 + UI kit 0.2.4) into framework main.
5. Roll Better (live) leaks players' persistentIds → seat takeover possible (BMUZ finding 39).
6. BMUZ stress test: 43 findings in ~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md.

## Where we are
Stage: develop · Milestone: v0.4 Play online · Sprint: — · Doing: bug sweep (B002, B003, B005, B006) · Branch: dev/alpha · Version: 0.0.0 · Live: none yet

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
- 2026-09-30 — Sprint 05 done (autonomous): move glide, rooms framework module (harvested from Roll Better), online server with per-player views, online seats, lobby, e2e:online (0 leaks); security review fixed 5 issues; layout fix for the reveal.
- 2026-09-30 — Sprint 04 done (autonomous): seats + handoff, new game screen, pause/rules, danger cues, staged Magic reveal, end table; Dev Kit 0.3.0 Snapshots + Bug capture (framework branch). Review fixed 2 bugs.
- 2026-09-30 — Sprint 03 done (autonomous): playable 2-player game — board, real-size tray, draft, turn flow + throw, basic results; review fixed 2 bugs.
- 2026-09-30 — Sprint 02 done (autonomous): rules engine (84 tests, 6,000 sim games), official word list byte-for-byte, Magic + refresh, UI kit Cozy night. Word Play researched.
- 2026-09-30 — Sprint 01 done: skeleton (Vite/React/TS, Dev Kit, PWA, Pages workflow), art, F01 prototype approved + throw story.
- 2026-09-30 — /define done: theme (Grand Glyphtender, Magic), cozy not hunting, alpha = pass-and-play + online, beta = AI. Official word list traced + kept. TDD + roadmap.
- 2026-09-30 — Project created (remake). Old repo/folder renamed to glyphtender-original. /discover done: digest, references, directions.
