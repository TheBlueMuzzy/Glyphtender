# Sprint 05 — Play online (local server)
Started 2026-09-30 (autonomous — Muzzy asleep) · Milestone v0.4 Play online · Features: F15 ∥ F18, then F19, F20
Goal: two browser windows (or a phone + the PC on Wi-Fi) create and join a room by code and play a full Glyphtender game against each other through a local PartyKit server — seeds and Magic stay secret.
What Muzzy will see change: glyphlings glide when they move · the main menu gets "Play online" → create a room (code) / join by code → lobby → the same game, each player on their own device. Stays the same: nothing is deployed — the online server runs on this PC only (`npm run party:dev`); putting it live on Cloudflare waits for Muzzy.

## F15 ✨ Move animation
- [x] 🤖 1. A moved glyphling glides along its leyline (planned move and committed move, incl. the other seats' moves in online play); reduce motion = instant — src/game, anim.json

## F18 🧱 Framework "rooms" module (harvest from Roll Better — framework branch dev/rooms)
- [ ] 🤖 2. dev/framework/rooms: engine-agnostic PartyKit room basics lifted from Roll Better — room codes, identity (persistentId owns the seat), join/leave/rejoin, host migration, AFK hook, a thin server base + client hook — with tests and a README card; installer like the kits
- [ ] 🤖 3. Online design doc for Glyphtender: who owns what, message list, per-player views, reconnect/seat rules, timers — .planning/design/online.md (Roll Better's design/tech-online.md is the reference)

## F19 🧱 Online server
- [ ] 🤖 4. party/server.ts on the rooms module: runs the same engine, validates every action, deals from its own seeded bag, sends each player only their own view (own seeds, others' counts, no Magic totals until the reveal)
- [ ] 🤖 5. Online seats in the store: actions go to the server; other players' moves arrive and animate (throw + sprout) like local ones; no handoff screen online

## F20 🎮 Create / join a room
- [ ] 🤖 6. Kit screens: Play online → Create (code shown, copy) / Join (code input) → Lobby (seats 2–4, ready, host starts with the new-game options) — src/ui
- [ ] 🤖 7. e2e: two browser contexts play a full online game through a local PartyKit server; secrets checked (a client never receives another hand) — e2e/
- [ ] 🙋 8. Try online with the phone + PC on Wi-Fi (`npm run party:dev` + `npx vite --host`); plus the open checks from Sprints 03–04 (turn flow, menus, handoff, reveal)
Check: npm test, build, check:ui, check:devkit, all e2e green; Claude looks at the screenshots first.

Ask Muzzy:
- Deploying the online server to Cloudflare (PartyKit) + GitHub Pages is public → waits for you (/deliver).
Notes:
- F15 (task 1): the glide lives in `src/game/useGlide.ts` (+ plain maths in `glide.ts`, tested). It watches where each glyphling is *drawn* — any change A → B glides, whatever caused it (tap/drop, Undo, ghost, dev hook, snapshots, online later). Time = moveBase 0.15 s + movePerHex 0.04 s × hexes, ease-in-out with a tiny 0.06-hex settle past the hex (`moveSettle`, 0 = none) — all in anim.json / Dev Kit → Tuning. Reduce motion = instant; planning is never locked by a glide. For task 5: when another seat's committed turn arrives, start its throw after `glideSeconds(from, to, anim)` so the seed leaves from the landed glyphling. e2e:game now checks a planned move and Undo both glide and saves `*-4b-gliding.png` (frozen halfway); both e2e scripts wait for glides to settle before screenshots.
