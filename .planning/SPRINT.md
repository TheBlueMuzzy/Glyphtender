# Sprint 02 — The garden's rules work
Started 2026-09-30 (autonomous — Muzzy asleep) · Milestone v0.2 Plant a garden · Features: F04, F05, F06, F03
Goal: a full 2–4 player game can be played start to finish by script — draft, move, cast, real words from the official list, Magic, refresh, tangles, tangle bonus — and the menus wear the Cozy night style.

## F04 🧱 Rules engine
Done when: every rule in GDD §4 has a test; a random-player simulation finishes thousands of games with no rule broken (seed count always 120 across bag + hands + board).
- [x] 🤖 1. Game state, seeded random, new game + snake draft (non-edge, not next to a glyphling) — src/engine/{types,rng,setup,draft}.ts
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
- [x] 🤖 9. Install the UI kit (Cozy), wire applyStyle + check:ui — src/ui/kit, content/ui/style.json, src/main.tsx
- [x] 🤖 10. Night colours as Cozy tweaks (readable contrast), home page = kit MainMenu (Prototype, Settings) — content/ui/style.json, src/App.tsx
- [ ] 🤖 11. Screenshots at 390×844, 844×390, 1440×900; nothing clipped
- [ ] 🙋 12. Look at the Cozy night menus; tweak colours in Dev Kit → Color if wanted

Ask Muzzy:
Notes:
- F04 engine: illegal actions THROW an Error with a plain reason; `checkAction(state, action, words)` returns the same reason (or null) without throwing, for the UI. The word list is passed into applyAction as a 3rd argument (it's too big to live in GameState). Rule numbers are copied from content/tuning/rules.json into `state.config.rules` at newGame, so a replay/online game uses the same numbers.
- F04 engine: glyphling ids are seat × 2 + 0/1 (Yellow = 0,1 · Blue = 2,3 …). Hands are dealt 8 each in seat order from the front of the bag.
- F03 task 9: kit 0.2.2 (framework db90181) installed with the Cozy preset; applyStyle + applyAccessibility wired in src/main.tsx; `npm run check:ui` passes. content/ui/settings.json = the kit's standard rows (accessibility tab kept).
- F03 task 10: night palette = Cozy tweaks in content/ui/style.json (TDD D09). Home page = kit MainMenu (title, tagline, "Prototype: move → cast" → sketches/move-cast/, Settings) in src/ui/menus.tsx; words in content/text/en.json; Settings → About → Credits opens the kit Credits screen. Settings rows switched off (not real yet): language (English only), change name, analytics, and the example.com privacy/feedback links. body has class="kit-page"; index.css placeholder styles removed.
- Word Play (GMTK) feel reference being researched → .planning/research/wordplay.md
