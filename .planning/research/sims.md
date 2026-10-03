# Simulations — rules engine (F04)
> 2026-09-30 · `npm run sim` (500 games per row, seeds 1–500) · official word list · rules from `content/tuning/rules.json` (hand 8, min word 2, +1 own seed, tangle +3, ends at 2 tangles).
> **Random** = any legal action. **Greedy** = tries 20 random legal turns, plays the one making the most Magic (no tangle tactics, no draft sense). Neither is a real player — these check the rules and give rough shapes, not balance.

| Player | Players · board | Avg turns (max) | Bag ran out | Ended by self-tangle | Turns making a word | Seat wins (Y / B / P / Pk) |
|---|---|---|---|---|---|---|
| random | 2 · small | 47.8 (69) | 0% | 92.6% | 40% | 49.4 / 52.4 |
| random | 2 · large | 62.4 (89) | 0% | 95.2% | 39.4% | 51.2 / 50.8 |
| random | 3 · small | 43.7 (63) | 0% | 86.4% | 37.5% | 35.4 / 35.2 / 31.6 |
| random | 3 · large | 58.8 (82) | 0% | 91.6% | 37.3% | 34 / 36 / 33.6 |
| random | 4 · small | 41.5 (61) | 0% | 78.2% | 35.6% | 30.2 / 25.6 / 25 / 25.6 |
| random | 4 · large | 56.6 (80) | 0% | 84.8% | 36.1% | 27.8 / 28.2 / 25.8 / 23 |
| greedy | 2 · small | 50.9 (75) | 0% | 90.2% | 91.2% | 50.8 / 50 |
| greedy | 2 · large | 66.9 (105) | 0.2% | 92.2% | 91% | 49.8 / 51.2 |
| greedy | 3 · small | 45.5 (72) | 0% | 81.2% | 90.1% | 32.8 / 36.8 / 33 |
| greedy | 3 · large | 60.7 (99) | 0.4% | 87.4% | 90.2% | 33 / 37.4 / 30.6 |
| greedy | 4 · small | 41.6 (67) | 0% | 75.6% | 89.3% | 27.6 / 27.2 / 24.4 / 24.2 |
| greedy | 4 · large | 54.6 (98) | 1.6% | 83.8% | 89.3% | 30.8 / 23 / 28.6 / 21.4 |

"Turns" = completed turns by all players (a 2-player game of 48 turns is 24 each). Seat wins: ties count for everyone tied, so a row can add up past 100%.

**What it says**
- **Rules hold:** every action checked — 120 seeds always (bag + hands + board), no hand over 8, no two pieces on a hex, turn order right, every game ended (longest 105 turns; cap 1000).
- **The bag almost never runs out** (GDD §9 ❓): every cast takes exactly one seed out of bag + hands for good — a draw after Magic *and* a refresh both top the hand back up — so the bag lasts 120 − 8×players casts (104 in 2p … 88 in 4p). Games end on tangles long before that; only a few long 4-player Large games got there. "Stop drawing" covers it.
- **Self-tangle endings dominate** with these players because they walk into dead ends blindly — expect far fewer from humans/AI. Worth re-running with the beta AI.
- **Seat order:** no clear first-player edge at this level of play (4-player Yellow ~28–31% vs 25% fair is within noise for 500 games, but worth watching with the AI). Board size mostly changes game length (~+15 turns on Large).
- Greedy players make a word ~90% of turns — the 2-letter words make scoring easy; the "min 3" table option would change that a lot (not simulated yet).

## 2026-10-01 — plain Q (F24): Q spells "Q", bag U4→U5, E16→E15
> `npm run sim` (500 games per row, seeds 1–500), same players as above, run on the code just before F24 and just after. New sim measure — what happens to the Q seed (share of games): **cast** = planted on the board · **scored** = in a word that made Magic · **refreshed** = set aside in a refresh · **stuck** = still in someone's hand when the game ended (the rest of the time it never left the bag).
> The "before" numbers for turns / bag / self-tangle / seat wins match the 2026-09-30 table exactly, so the runs are comparable. Changing the bag changes every shuffle, so each game is a different game after — small moves (±2 points) are noise.

**Greedy players** (the meaningful ones for the Q — they pick the turn that makes the most Magic)

| Players · board | Avg turns before → after | Bag ran out | Q cast | Q scored | Q refreshed | Q stuck at end |
|---|---|---|---|---|---|---|
| 2 · small | 50.9 → 51.4 | 0 → 0% | 14.2 → 10.6% | 11.4 → 7.6% | 9.2 → 13% | 38 → 41.8% |
| 2 · large | 66.9 → 67.1 | 0.2 → 0% | 21.4 → 16.6% | 16.6 → 11.2% | 15.2 → 18.2% | 40 → 48.6% |
| 3 · small | 45.5 → 45.5 | 0 → 0% | 8.4 → 9.2% | 5.6 → 5.4% | 10.6 → 12.6% | 43.2 → 47.8% |
| 3 · large | 60.7 → 60.1 | 0.4 → 0.6% | 14.4 → 13% | 10.8 → 7.6% | 15.2 → 16.4% | 50.6 → 55.6% |
| 4 · small | 41.6 → 40.9 | 0 → 0% | 10 → 9.2% | 7.2 → 4.2% | 9.8 → 9.6% | 44.8 → 53.8% |
| 4 · large | 54.6 → 54.5 | 1.6 → 0.4% | 12.6 → 11.8% | 8.6 → 6.2% | 13 → 14.8% | 54.2 → 57.4% |

**Random players** (any legal action — they cast the Q as readily as any seed, so this mostly shows the bag, not the letter)

| Players · board | Avg turns before → after | Bag ran out | Q cast | Q scored | Q refreshed | Q stuck at end |
|---|---|---|---|---|---|---|
| 2 · small | 47.8 → 47.7 | 0 → 0% | 33.2 → 41.8% | 4.4 → 6.2% | 45.8 → 43% | 14.6 → 11.8% |
| 2 · large | 62.4 → 63.4 | 0 → 0% | 51.6 → 53.6% | 5.4 → 6.6% | 48.6 → 53.8% | 16.2 → 13.6% |
| 3 · small | 43.7 → 43.6 | 0 → 0% | 34.2 → 38.6% | 4.2 → 4.4% | 42.2 → 45% | 23.6 → 18% |
| 3 · large | 58.8 → 58.3 | 0 → 0% | 46 → 49.4% | 5.4 → 6.4% | 51.4 → 53.2% | 24 → 19.4% |
| 4 · small | 41.5 → 41.9 | 0 → 0% | 31.8 → 35.4% | 4 → 5.6% | 39.2 → 44.2% | 28.8 → 24% |
| 4 · large | 56.6 → 55.9 | 0 → 0% | 45 → 48% | 6 → 4.6% | 49 → 53% | 30.6 → 23.8% |

**What it says**
- **Game shape unchanged:** game length moves by under a turn in every row, the bag still almost never runs out (0–0.6%), turns making a word stay ~89–91% (greedy) / ~35–40% (random), self-tangle endings and seat wins within noise.
- **The plain Q is a slightly harder seed for a greedy player:** it lands in a scoring word in ~4–11% of games (was ~6–17%), and sits in a hand at the end of ~42–57% of games (was ~38–54%). It needs a U next to it (or one of the ~10 Q-without-U words like QI / QAT), where the old Qu seed only needed a vowel after it.
- **Refreshed a little more** (greedy ~10–18%, up 0–5 points) — but the sim's refresh is random (each seed set aside 1-in-3), it never chooses to dump a dead Q. A human holding a Q with no U in sight can refresh it away, so real players should be stuck with it less than this.
- **Random players** cast the Q a bit more and get stuck with it less after — they never decide by letter, so this is the reshuffle, not the rule.
- Worth watching with the beta AI: whether holding the Q feels like a dead seat in the hand. The knob if it does: a sixth U in content/data/bag.json (from another E).

## 2026-10-02 — skill awards: a FLOOR check (`npm run sim:awards`)
> 200 games per row × random / greedy × 2, 3, 4 players × Small, Large = **2,400 games**, seeds 1–200, official words. Share of games where each award was earned by anyone, at the thresholds now in content/tuning/endscreen.json.
> **These players can't tell us how often SKILLED play earns the positioning awards** — random plays any legal move, greedy picks the most Magic of 20 random turns; neither positions or blocks on purpose (Muzzy). So this is only a floor check: an award these players earn often is too easy (earned by accident) and its threshold went up until mindless play rarely gets it; the rest were set by hand to clearly deliberate values. **All thresholds are PROVISIONAL — re-tune once the beta AI personalities can play positionally (AI-vs-AI).**

| Award | Threshold (provisional) | Random | Greedy | Notes |
|---|---|---|---|---|
| Lockdown | a rival glyphling ≥ 6 moves fewer, ≤ 1 left | 3.2% | 7.3% | 5 / ≤ 2 was 14% / 20% |
| Pincer | move AND cast each ≥ 4 fewer, ≥ 8 in all | 8.6% | 8.8% | 2 / 5 was 51% / 50% |
| Weed toss | cast made 0 and took a rival's ≥ 14-Magic spot, or cut ≥ 10 + refreshed | 9.4% | 0.3% | random's junk casts land anywhere: the cut kind is what random earns (≥ 7 was 32%) |
| Walled garden | own cast sealed a ≤ 10-hex pocket, ≥ 30 Magic made inside | 9.8% | 16.9% | without the size cap random play "seals" half the board by chance (12 Magic: 44% / 49%) |
| Through the hedge | a scoring cast over ≥ 4 own seeds | 6.3% | 22.3% | 2 was 57% / 78% — a crowded garden makes it easy |
| Complete tangle | (no threshold) | 1.5% | 2.3% | natural rate |
| Power Play | ≥ 5 words from one seed | 1.9% | 5.6% | 3 was 69% / 97%, 4 was 19% / 45% (2-letter words make many) |
| Long word | ≥ 6 letters (both gardens) | 0% | 6.5% | 5 letters: greedy 39% Small / 46% Large |
| Hijack | rival's word of ≥ 3 letters grown, you own most | 0.8% | 24.3% | from 2-letter words greedy hit 90%; ≥ 4 is 5% |
| Bridge | ≥ 2 letters each side of the seed | 0.3% | 1.9% | 1 each side: 64% / 84% |
| Biggest comeback | took the lead from ≥ 12 behind | 2.3% | 10.0% | 8 was 15% / 49% |
| Trickster's Victory | a rival ended it ≥ 10 behind → the winner | 27.6% | 31.8% | natural rate: these bots end ~75–95% of games by tangling their own glyphling |
| Called it | ended it ≥ 10 ahead, and won | 24.7% | 32.7% | natural rate (same reason) |
| Close call | 1 move left at the start of your turn, ≥ 6 after, never tangled | 3.2% | 4.0% | 4 was 12% / 8% |

Awards per game at these thresholds: random 1.0 · greedy 1.8 (2,400 games). Per-row numbers: `npm run sim:awards`.

**What it says**
- **Mindless play now rarely earns a positioning award** (≤ 10% of games for random and greedy, Walled garden 17% for greedy) — so when a real player gets Lockdown / Pincer / Weed toss / Walled garden it most likely came from a deliberate squeeze.
- **Spelling awards are where greedy (a Magic-maximiser — a spelling skill) is ahead of random**, as it should be: Hijack 24%, Through the hedge 22%, Long word 6.5%.
- **The ending awards ride on how games end.** Sim bots end almost every game by self-tangling, so Trickster's Victory and Called it are ~25–33% here; humans and the beta AI (who won't walk into dead ends blindly) should see them less — and more often deliberately.
- Next: re-run with the beta AI personalities playing each other (ROADMAP → Later: "Re-tune award thresholds with AI personalities (AI-vs-AI)") and aim the positioning awards at "most games have one, nobody gets everything".

## 2026-10-03 — awards re-tuned from Muzzy's real game (`npm run sim:awards`, 2,400 games)
> Muzzy's first full 2p game earned 0 awards; `npx tsx scripts/award-near-misses.ts e2e/fixtures/muzzy-zero-awards.json` showed near-misses everywhere and a Walled garden bug (D55). Changes: Walled garden counts any wall and follows the garden as it shrinks; hedge ≥ 3 · close call ≥ 4 · power play ≥ 4 · comeback no minimum.

| award | random | greedy |
|---|---|---|
| lockdown | 3.2% | 7.3% |
| pincer | 8.6% | 8.8% |
| weedToss | 9.4% | 0.3% |
| walledGarden | 14.3% | 32.3% |
| throughHedge | 22.4% | 46.1% |
| completeTangle | 1.5% | 2.3% |
| powerPlay | 19.3% | 44.6% |
| longWord | 0.0% | 6.5% |
| hijack | 0.8% | 24.3% |
| bridge | 0.3% | 1.9% |
| comeback | 77.8% | 92.3% |
| trickster | 27.6% | 31.8% |
| calledIt | 24.7% | 32.7% |
| closeCall | 11.8% | 8.1% |

Awards per game: **random 2.31 · greedy 3.76** (was 1.0 · 1.8). Muzzy's game: 0 → 4 (Walled garden 43 Magic in a 4-hex garden, Through the hedge ×2, Biggest comeback from 9 behind).
- Biggest comeback is now near-universal by design (Muzzy: always award the biggest comeback).
- Walled garden is earned by bots more often now (any wall counts) — Muzzy's call; re-check with the beta AI.
