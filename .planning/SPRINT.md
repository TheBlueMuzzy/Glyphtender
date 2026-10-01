# Sprint 07 — Polish: a readable ending, plain Q, word spotlight, 4 players, screen previews
Started 2026-10-01 (autonomous — Muzzy asleep) · Milestone v0.5 Polish · Features: F24 ∥ F28 ∥ (research), then F25, F26, F27
Muzzy's words (2026-10-01): "overhaul how the winning screen looks… it was confusing, cluttered, cramped, and didn't highlight interesting things. Biggest is the main scores. then a breakdown… solo words (words that contained only your tiles), quantity of 2*, 3, 4, 5, 6+ letter words. Points from tangles. qty of letters refreshed, maybe a graph of the scores throughout the game [with] tangle moments… a dot on the line. qty of multi-word turns. up to 4 players… maybe the thing you're trying to do is in the middle, and 1 (or 2) on the left and 1 (or 2) on the right… there's probably more interesting moments to share, so think on that." · "the DevKit [could show] windows/screens/states that are usually gated… not let it break the game… these are just previews." · "did you have 4 player working? … definitely get that working too." · AI waits until he can describe it. "do research so you're familiar with how other games solve certain things."
(* "2*" = 2-letter words exist only when the table allows 2-letter words.)

## F24 🎮 Plain Q (+1 U, −1 E)
Done when: a Q seed spells "Q"; QI/QAT score, QUA needs a U seed; bag 120 with U5 E15; sims still healthy
- [ ] 🤖 1. Engine: spell Q as "Q"; bag U5 E15 — src/engine/words.ts, setup.ts, tests; GDD §bag + rule; server words unchanged
- [ ] 🤖 2. Art/labels: the Q seed shows "Q" (no "u" anywhere) — art.ts / tray / tile art check
- [ ] 🤖 3. `npm run sim` before/after → research/sims.md (bag run-out, game length, Q dead-seed rate)
Check: unit tests + sims

## F28 🧪 4 players everywhere
Done when: a full 4-player pass-and-play game and a full 4-player online game run in e2e on phone + desktop sizes, no clipping
- [ ] 🤖 4. e2e: 4-player pass-and-play (and 3-player) through to the end table — e2e/
- [ ] 🤖 5. e2e: 4-player online (4 browser contexts) incl. secrecy check — e2e/online-shots.mjs or a new script
- [ ] 🤖 6. Fix whatever breaks (turn bar, handoff, end table, lobby with 4 seats)

## F25 ✨ Word spotlight
Done when: after a cast, words light up one at a time (QUA → TAB → AY → loop) until play moves on; one word = just that word; reduce motion respected; timings in content/
- [ ] 🤖 7. Spotlight cycle in WordBorders (+ the "Cast · +N" preview while planning?) — src/game/WordBorders.tsx, content/tuning
- [ ] 🤖 8. Show the word itself (e.g. a small label "QUA +4") as each lights? — try it behind a toggle, default on if it reads well
- [ ] 🤖 9. e2e shots: two/three-word cast cycles; online other players' turns too

## F26 🎮 Game log + end screen overhaul
Done when: the end screen leads with big scores (winner obvious), then per-player breakdowns and a score-over-time chart with moment dots; works 2/3/4 players on phone portrait, landscape, desktop; online-safe (log hidden until the game is over)
- [x] 🤖 10. Research: end/results screens in digital board & word games + "interesting moments" → research/end-screen.md
- [ ] 🤖 11. Engine game log: per turn — seat, words (letters, owners, Magic), tangles, refreshes, Magic after the turn — src/engine; server views hide it until over (secrecy tests)
- [ ] 🤖 12. Stats from the log: solo-word Magic, word counts by length (2*,3,4,5,6+), tangle Magic, letters refreshed, multi-word turns, moments (best word, biggest turn, lead changes…) — src/game/stats.ts + tests
- [ ] 🤖 13. End screen design + build from kit parts (game-ui): scores → breakdowns → chart with dots; layout for 2/3/4 players; text in en.json
- [ ] 🤖 14. Screens: 2p/3p/4p × portrait/landscape/desktop — look at every one
Ask Muzzy: (left for his morning review)

## F27 🔧 Dev Kit Screen previews
Done when: a Dev Kit tab lists the gated screens (end screen 2/3/4p, reveal, handoff, lobby, pause, new game…) and opens each with sample data in a sandbox; closing it returns to exactly where you were; the real game state is never touched
- [ ] 🤖 15. Design: how previews are sandboxed (separate store/fixtures, overlay, no saves/sends) — framework-first if it fits (dev/framework devkit)
- [ ] 🤖 16. Build the tool + Glyphtender's preview list + sample data (from F26 fixtures / snapshots)
- [ ] 🤖 17. e2e: open every preview, close, game unchanged; Dev Kit stays out of live builds

Notes:
- Research (task 10): research/end-screen.md — 3 swipe pages Results · Story · Scorecard; winner big + centred ABOVE the others on phone (a 2-1-3-4 podium is hard to read at 390 px and with ties — podium only in landscape/desktop; weighs Muzzy's "winner in the middle"); awards never add points, ≤1 per player until all have one; chart = cumulative Magic per round + a final Tangles column, end-of-line labels, knot/star/tick markers. "2*" read as 2-letter words shown only when the table allows them — Ask Muzzy to confirm.
