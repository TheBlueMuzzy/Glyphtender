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
