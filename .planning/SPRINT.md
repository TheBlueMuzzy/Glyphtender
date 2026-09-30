# Sprint 01 — Move and cast on your phone
Started 2026-09-30 · Milestone v0.1 Sketch · Features: F02, F01 (in this order)

## F02 🧱 Project skeleton
Done when: `npm run dev` gives a phone link on Wi-Fi, `npm test` and `npm run build` pass, the Dev Kit opens with ` (or triple-tap), and the deploy workflow is ready for /deliver.
- [x] 🤖 1. Vite + React + TS app, `base: '/glyphtender/'`, `server.host: true` — package.json, vite.config.ts, src/main.tsx
- [x] 🤖 2. vitest wired, first test — src/engine/hex.test.ts
- [x] 🤖 3. GitHub Pages workflow (test + build + deploy on main) + PWA (`registerSW({immediate:true})`) — .github/workflows/deploy.yml, vite.config.ts
- [ ] 🤖 4. Dev Kit install + wiring — `node ~/Documents/dev/framework/devkit/scripts/install-devkit.mjs .`, content/devkit.json, content/tuning/
- [ ] 🤖 5. Stand-in art: runeblossoms (A–Z × 4) + glyphlings → 256 px WebP — public/art/, content/credits.json (stand-in)
Check: build passes; dev link loads on a phone; Dev Kit opens.

## F01 ❓ Prototype: move → cast → undo (code sketch)
Done when: Muzzy has played it on his phone both ways up and on desktop, and decided the commit style.
- [ ] 🤖 6. Hex math + both boards from column heights, night board SVG, auto-fit — sketches/move-cast/, content/data/boards.json
- [ ] 🤖 7. Shape-based layout: tall → tray below, wide → tray beside — sketches/move-cast/
- [ ] 🤖 8. Move (tap/drag glyphling → legal hexes glow) → cast (tap/drag seed → legal hexes glow) → Undo / tap-again → Cast commits, go again with any piece — sketches/move-cast/
- [ ] 🤖 9. Screenshots at 390×844, 844×390, 1440×900 on both boards; measure hex size in px
- [ ] 🙋 10. Play it on phone (portrait + landscape) and desktop; decide: one Cast + undo, or confirm each step
- [ ] 🤖 11. Learnings → GDD §3/§4 + TDD; F01 ✅
Check: screenshots look right to Claude first; then Muzzy's feel call.

Ask Muzzy: —
Notes:
- Dev Kit moved from F03 into F02 so the sketch's hex size / colours are tweakable live (F03 = UI kit only).
- D07: tool versions match Roll Better (Vite 7, TS 5.9, React 19, vitest 4) — the kits are proven there.
- Hex maths written as real engine code (`src/engine/hex.ts` + tests), not sketch code — the sketch borrows it.
- Live Pages link only updates at /deliver; sketch testing uses the Wi-Fi dev link.
