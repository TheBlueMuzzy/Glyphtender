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
