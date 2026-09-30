# Sprint 02 — The garden's rules work
Started 2026-09-30 (autonomous — Muzzy asleep) · Milestone v0.2 Plant a garden · Features: F04, F05, F06, F03
Goal: a full 2–4 player game can be played start to finish by script — draft, move, cast, real words from the official list, Magic, refresh, tangles, tangle bonus — and the menus wear the Cozy night style.

## F04 🧱 Rules engine
Done when: every rule in GDD §4 has a test; a random-player simulation finishes thousands of games with no rule broken (seed count always 120 across bag + hands + board).
- [ ] 🤖 1. Game state, seeded random, new game + snake draft (non-edge, not next to a glyphling) — src/engine/{types,rng,setup,draft}.ts
- [ ] 🤖 2. Turn: move legality, cast legality (over own pieces, not others'), move-only when no cast possible — src/engine/turn.ts
- [ ] 🤖 3. Tangles, game end at 2, tangle bonus (rivals only) — src/engine/tangle.ts
- [ ] 🤖 4. Random-player simulation + invariants (seed conservation, turn order, termination) — src/engine/sim.ts, scripts/sim.mjs
Check: `npm test`; `npm run sim` prints game lengths + how often the bag runs out.

## F05 🧱 Official word list + word finder
Done when: the original's words.txt is in the game byte-for-byte and every scoring example from the digest passes.
- [ ] 🤖 5. Copy words.txt unchanged → public/words/words.csv; loader → Map<word, zipf>; test the Zipf tier counts — src/engine/words.ts
- [ ] 🤖 6. Word finder on the 3 leylines: reading direction, min length, Qu, union rule (GARDENING/DEN, SEAL+LEAP/ALE, HELP+PEA) — src/engine/words.ts

## F06 🧱 Magic + draw / refresh
- [ ] 🤖 7. Magic = seeds + 1 per own seed; shared letters count per word; made Magic → draw 1 — src/engine/turn.ts
- [ ] 🤖 8. Refresh: set aside any number, refill to 8, return set-aside seeds to the bag; bag empty → stop drawing — src/engine/turn.ts

## F03 🧱 UI kit (Cozy, night colours)
- [ ] 🤖 9. Install the UI kit (Cozy), wire applyStyle + check:ui — src/ui/kit, content/ui/style.json, src/main.tsx
- [ ] 🤖 10. Night colours as Cozy tweaks (readable contrast), home page = kit MainMenu (Prototype, Settings) — content/ui/style.json, src/App.tsx
- [ ] 🤖 11. Screenshots at 390×844, 844×390, 1440×900; nothing clipped
- [ ] 🙋 12. Look at the Cozy night menus; tweak colours in Dev Kit → Color if wanted

Ask Muzzy:
Notes:
- Word Play (GMTK) feel reference being researched → .planning/research/wordplay.md
