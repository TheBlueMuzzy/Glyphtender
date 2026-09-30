// B007 INVARIANT, shared by the game, pass-and-play and online e2e scripts: once a landing's score pops have played
// (every pop animation finished), none of their numbers may still show on the board. Opacity counts, not just being
// in the page — the pops stay in the page until the next landing, held by their animations' last frames.
// Returns the numbers still showing ("+2@0.2" = text@opacity) — an empty list is a pass.
export async function leftoverPops(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-score-pops] text')]
    .every((el) => el.getAnimations().every((a) => a.playState === 'finished')), null, { timeout: 8000 })
  return page.evaluate(() => [...document.querySelectorAll('[data-score-pops] text')]
    .filter((el) => { const css = getComputedStyle(el); return Number(css.opacity) > 0.01 && css.visibility !== 'hidden' && css.display !== 'none' })
    .map((el) => `${el.textContent}@${getComputedStyle(el).opacity}`))
}
