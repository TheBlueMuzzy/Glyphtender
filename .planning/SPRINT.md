# Sprint 01 — Move and cast on your phone
Started 2026-09-30 · Milestone v0.1 Sketch · Features: F02, F01 (in this order)

## F02 🧱 Project skeleton
Done when: `npm run dev` gives a phone link on Wi-Fi, `npm test` and `npm run build` pass, the Dev Kit opens with ` (or triple-tap), and the deploy workflow is ready for /deliver.
- [x] 🤖 1. Vite + React + TS app, `base: '/glyphtender/'`, `server.host: true` — package.json, vite.config.ts, src/main.tsx
- [x] 🤖 2. vitest wired, first test — src/engine/hex.test.ts
- [x] 🤖 3. GitHub Pages workflow (test + build + deploy on main) + PWA (`registerSW({immediate:true})`) — .github/workflows/deploy.yml, vite.config.ts
- [x] 🤖 4. Dev Kit install + wiring — `node ~/Documents/dev/framework/devkit/scripts/install-devkit.mjs .`, content/devkit.json, content/tuning/
- [x] 🤖 5. Stand-in art: runeblossoms (A–Z × 4) + glyphlings → 256 px WebP — public/art/, content/credits.json (stand-in)
Check: build passes; dev link loads on a phone; Dev Kit opens.

## F01 ❓ Prototype: move → cast → undo (code sketch)
Done when: Muzzy has played it on his phone both ways up and on desktop, and decided the commit style.
- [x] 🤖 6. Hex math + both boards from column heights, night board SVG, auto-fit — sketches/move-cast/, content/data/boards.json
- [x] 🤖 7. Shape-based layout: tall → tray below, wide → tray beside — sketches/move-cast/
- [x] 🤖 8. Move (tap/drag glyphling → legal hexes glow) → cast (tap/drag seed → legal hexes glow) → Undo / tap-again → Cast commits, go again with any piece — sketches/move-cast/
- [x] 🤖 9. Screenshots at 390×844, 844×390, 1440×900 on both boards; measure hex size in px
- [ ] 🙋 10. Play it on phone (portrait + landscape) and desktop; decide: one Cast + undo, or confirm each step
- [ ] 🤖 11. Learnings → GDD §3/§4 + TDD; F01 ✅
Check: screenshots look right to Claude first; then Muzzy's feel call.

Ask Muzzy: —
Notes:
- Dev Kit moved from F03 into F02 so the sketch's hex size / colours are tweakable live (F03 = UI kit only).
- D07: tool versions match Roll Better (Vite 7, TS 5.9, React 19, vitest 4) — the kits are proven there.
- Hex maths written as real engine code (`src/engine/hex.ts` + tests), not sketch code — the sketch borrows it.
- Art: 104 runeblossoms + 4 glyphlings = 1.4 MB as WebP (256 px). Flat-top hex frames with transparent corners — they drop straight onto the board. Plain **Q**, no **Qu** art yet (Muzzy: when redrawing). Budget watch: one letter set + colour tint would cut this ~4×.
- F01 sketch at `/sketches/move-cast/`: both boards, **One Cast** vs **Confirm each** toggle (so Muzzy can compare directly), tap + drag (dragged piece floats 56 px above a finger), tap the faded ghost to send a glyphling back, tap a placed seed to take it back. Layout + garden colours are Dev Kit sliders (`content/tuning/layout.json`, `garden.json`).
- Measured hex width (task 9): phone portrait Small 42 px / Large 36 px · phone landscape 41 / 38 · desktop 97 / 89. Better than the 32–37 px predicted.
- Found by the screenshot check: 8 seeds in one row don't fit a 390 px phone at finger size → portrait tray is 2 rows of 4 when needed (portrait has spare height anyway). Clipping check added to `npm run e2e:sketch`.
- Found: you can cast back onto the hex your glyphling just left (it's empty) — that's where the ghost sits. With a seed selected the tap casts; otherwise it sends the glyphling back. Highlights draw above the ghost so it's visible. Real game: keep this rule, it's legal.
- Muzzy on the sketch (2026-09-30): "this is close. it's better for sure" — **flow approved (One Cast)**; the *look* must sell the story: target the spot (seed looks ghosted) → on Cast the glyphling throws the seed, it arcs to the target, the runeblossom grows. Also: planned glyphling had no ring while the planned seed did → standardise.
- Added: **design language** — options = glow + dot (teal move / gold cast) · held = solid ring in player colour · planned = pulsing halo at the hex edge in player colour (targeted seed also faded) · done = plain. Throw: glyphling hop → seed arcs (bezier, time = base + per-hex) → runeblossom sprouts with overshoot. All timings in `content/tuning/anim.json`, colours in `garden.json`. Input locked while a seed is in the air.
- Halo sits at the hex edge (1.02), outside the art's own coloured frame — drawn on top of the frame it blended in.
- /code-review skipped for the sketch (throwaway by design); runs on the real build from F04 on.
- Live Pages link only updates at /deliver; sketch testing uses the Wi-Fi dev link.
