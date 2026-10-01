## ▶ RESUME HERE
F23 built on branch `dev/online`: the online server now runs on Muzzy's own Cloudflare (PartyServer + wrangler, TDD D46) and is **live** at glyphtender.joebrogno.workers.dev — e2e:online passes against it (full game, 0 leaks). deploy.yml now sets VITE_PARTY_HOST, so **Play online appears on the live site once `/deliver` merges dev/online** (v0.1.1). Next: Muzzy tries online (phone + PC) → "approved" → `/deliver`.
Open decisions (defaults built): word list B001 · online timer/away rules · Magic secrecy · desktop button size · merge framework dev/rooms · Roll Better persistentId leak.

## Where we are
Stage: develop · Milestone: v0.4 Play online · Sprint: — · Doing: F23 — built, waiting on Muzzy's try · Branch: dev/online · Version: 0.1.0.0 · Live: https://thebluemuzzy.github.io/glyphtender/ (alpha)

## Key facts
**Remake.** Web remake of the Unity game. The original is read-only reference at `../glyphtender-original` (GitHub `TheBlueMuzzy/glyphtender-original`, renamed from `Glyphtender` 2026-09-30). Never copy it wholesale — pull ideas/assets across deliberately. Digest: `.planning/research/original-digest.md`.
**AI source of truth** is the original's branch `festive-booth` (goal-selection model), not its `main`.
**Muzzy's direction (2026-09-30):** phone (portrait AND landscape) + desktop — do responsive properly · first release = strong pass-and-play (AI replaces a seat next; online = "P0.5", reuse Roll Better's rooms if cheap) · tutorial not yet · UI kit **Cozy** style · think critically vs industry standards, don't just port.
**BMUZ stress test:** log BMUZ gaps in `~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/FINDINGS.md` as we go.
**Default branch:** main (deploys to GitHub Pages on push). Next work branch: `dev/beta` (made by /develop).
**Release:** GitHub Pages (recipe ~/.claude/config/bmuz/release/github-pages.md) + online server on Muzzy's own Cloudflare: `npm run party:deploy` (wrangler; logged in on the PC) → glyphtender.joebrogno.workers.dev. Deploy the server BEFORE the site when party/ or the engine changes. Live builds hide Play online unless VITE_PARTY_HOST is set in deploy.yml (it is, from dev/online).
**Sims:** `npm run sim` (research/sims.md): bag runs out in 0–1.6% of games; games 42–67 turns.
**Online dev:** `npm run party:dev` (wrangler dev on port 1997 — Roll Better uses 1999) + `npm run dev`; e2e: `e2e:game`, `e2e:pass`, `e2e:online` (each starts its own servers; run one at a time).
**Run:** `npx vite --host --port 5180` (dev port 5180) · tests `npm test` · sketch check `npm run e2e:sketch` (needs the dev server).
**Don't re-break:** a score pop's LAST animation frame must be invisible (opacity 0) — the pops stay in the page until the next landing, held by fill (B007; e2e/leftover-pops.mjs) · before the move a tray seed can't be dragged at all, not even to reorder — it shakes (B008, Muzzy's call). · a targeted seed is never see-through — no opacity on it, only a plannedSeedLook filter (B010) · after Refresh N the handoff / next player waits until the tray's shrink → grow has played (B011). · online, a seat's here / away / bot status comes from the room message (seat kind + connected) — the TurnBar badge and the seat toasts read it there, not from the game view (B015).

## Log
- 2026-09-30 — F23: online server moved to Muzzy's own Cloudflare (PartyServer); deployed + e2e green against live.
- 2026-09-30 — Alpha release prep: live online host set, returning-player update check, credits; all checks green. Delivering v0.1.0.
- 2026-09-30 — Sprint 06 Feel pass (autonomous): Muzzy's 11 playtest notes built + 7 bugs fixed by e2e and review; 197 tests.
- 2026-09-30 — Bug sweep (autonomous): word-list failure now shows Retry (and End turn no longer waits for words), draft ignores illegal taps quietly, right-click no longer taps, snapshots keep end-table stats. 168 tests, all e2e green.
- 2026-09-30 — Sprint 05 done (autonomous): move glide, rooms framework module (harvested from Roll Better), online server with per-player views, online seats, lobby, e2e:online (0 leaks); security review fixed 5 issues; layout fix for the reveal.
- 2026-09-30 — Sprint 04 done (autonomous): seats + handoff, new game screen, pause/rules, danger cues, staged Magic reveal, end table; Dev Kit 0.3.0 Snapshots + Bug capture (framework branch). Review fixed 2 bugs.
- 2026-09-30 — Sprint 03 done (autonomous): playable 2-player game — board, real-size tray, draft, turn flow + throw, basic results; review fixed 2 bugs.
- 2026-09-30 — Sprint 02 done (autonomous): rules engine (84 tests, 6,000 sim games), official word list byte-for-byte, Magic + refresh, UI kit Cozy night. Word Play researched.
- 2026-09-30 — Sprint 01 done: skeleton (Vite/React/TS, Dev Kit, PWA, Pages workflow), art, F01 prototype approved + throw story.
- 2026-09-30 — /define done: theme (Grand Glyphtender, Magic), cozy not hunting, alpha = pass-and-play + online, beta = AI. Official word list traced + kept. TDD + roadmap.
- 2026-09-30 — Project created (remake). Old repo/folder renamed to glyphtender-original. /discover done: digest, references, directions.
