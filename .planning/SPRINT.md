# Sprint 06 — Feel pass (Muzzy's notes)
Started 2026-09-30 (autonomous — Muzzy at work) · Milestone v0.4 (alpha polish) · Features: tuning of F08, F09, F12, F13, F14 (+ GDD §4 "Muzzy's feel notes")
Goal: the turn reads and feels right — you always know whose turn it is, what you can do, where things will land, and what you just scored.
What Muzzy will see change: score pops that gather into a total over the caster; white word borders behind the letters (or none, by option); gold cast hexes as soon as you move; the drop hex lights up while dragging; turn pulse on your glyphlings; a "no" shake; bigger buttons; tray closer; the prompt above the tray; a flip-layout setting; end screen with just New game. Stays the same: rules, online, reveal.

- [x] 🤖 1. Word indicators option (new game; online = host's lobby option): on → white border-thick highlight BEHIND the word's seeds (planned words while aiming + grown words after); off → no outline, no "+N" on Cast, no score pops — content/tuning/garden.json, src/game, src/ui
- [ ] 🤖 2. Score pops: each seed of each made word pops its Magic (+1 / +2 own) above it, then they fly together into one bigger total over the casting glyphling (all words in the turn) — all players see it (online too); timings in anim.json; reduce motion = just the total
- [ ] 🤖 3. Cast ranges (gold) show as soon as a glyphling has moved (planned), before a seed is picked; picking a seed keeps them
- [ ] 🤖 4. Drop target: while dragging a glyphling or seed, the legal hex under the lifted piece lights up (distinct from the other options)
- [ ] 🤖 5. Turn pulse: the current local player's movable glyphlings pulse gently (small scale) until one is moved (planned move); tangled ones don't pulse
- [ ] 🤖 6. "No" shake: tapping/dragging anything you can't move (others' glyphlings, placed seeds, tangled glyphling, not your turn online) gives a quick sideways shake
- [ ] 🤖 7. Layout: buttons finger-sized (≈ glyphling hex size, ≥ 44 px) on phone + PC (kit-first if the kit can't size buttons); tray gap to the board ~half; prompt moves from the top bar to just above the tray, larger, balanced
- [ ] 🤖 8. Setting (Settings → Gameplay, remembered): flip board ↔ tray (tall: tray on top; wide: tray on the left)
- [ ] 🤖 9. End screen: only New game (+ Menu); online: New game = back to the lobby for everyone (host starts)
- [ ] 🤖 10. e2e: all three scripts updated; screenshots at 3 sizes incl. score pops mid-flight, drop target, turn pulse, flipped layout; Claude looks at them
- [ ] 🙋 11. Play it again — do the pops, word borders, pulse and shake feel right?
Check: npm test, tsc, lint, check:ui, check:devkit, build, e2e:game/pass/online green.

Ask Muzzy:
- Word indicators OFF also hides "Cast · +N" and the score pops (else they'd give words away) — right? Or should the score pops still show after a cast?
Notes:
- Muzzy 2026-09-30: "looks so good." Feedback list → GDD §4 "Muzzy's feel notes". Turn pulse: he settled on "ends after you move a glyphling".
- Task 1 (word indicators): new-game row "Word indicators" (remembered with the other choices) + the host's lobby row online (`OnlineOptions.wordIndicators`, checked on the server, sent to every player in each view's `options`). On: ONE look for planned words (while aiming) and grown words (after landing) — a white ring centred on each word hex's edge (garden.json `wordBorder` #ffffff, `wordBorderWidth` 0.2 hex), drawn UNDER the seed art so the letters sit on top and only the outer part shows (`src/game/WordBorders.tsx`). Grown: same ring, fades (grownGlowStrength 0.6 → 1: it's now the border's own strength, not a colour fill's). Off: no border, Cast shows plain "Cast", no pops. `wordOutlineWidth` replaced by `wordBorder` + `wordBorderWidth`. +3 tests.
