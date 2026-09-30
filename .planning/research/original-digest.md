# The Unity original — design + tech digest

> Read-only reference: `../glyphtender-original` (GitHub `TheBlueMuzzy/glyphtender-original`, last build v792 / 0.4.1).
> Scripts: `Unity/GlyphtenderUnity/Assets/Scripts/{Core,Unity,Unity/Network}`. Written 2026-09-30 from the code, docs and transcripts. **Code beats docs** — HANDOFF.md numbers are stale in places (noted below).
> Rule from the DoomDial remake: never copy the old project wholesale — pull ideas and assets across deliberately.

## 1. Rules (as the code runs them)
**Identity** (HANDOFF §1.1): *"An area control game with a spelling element, not a spelling game with area control."* Full title "The Glyphtender's Trial". Began as a physical board game.

**Board** — flat-top hexes, offset columns, 3 axes / 6 directions (N/S, NE/SW, NW/SE), deliberately no horizontal line. Muzzy calls lines "leylines". Designer notation `C4-3` (column 4, 3rd hex from top). Sizes (`Core/Board.cs:136-146`):
- Small (docs say "Medium"): 11 cols `[4,7,8,9,10,9,10,9,8,7,4]` = 85 hexes
- Large: 13 cols `[5,8,9,10,11,10,11,10,11,10,9,8,5]` = 117 (HANDOFF's "106" is stale)
- Original paper board: 92 hexes `[5,8,9,10,9,10,9,10,9,8,5]` — `layout.png` in the original, with starting spots C4-3, C8-3, C4-8, C8-8 circled
- A third tiny board was removed — 4-player draft broke on it.

**Pieces** — 2 **glyphlings** per player (Yellow, Blue, Purple, Pink — in turn order). Letter tiles are **runeblossoms**. Hand = 8 (`GameRules.cs:13`).

**Tile bag** — code (`GameRules.cs:17`): A9 B2 C2 D4 E12 F2 G3 H2 I9 J1 K1 L4 M2 N6 O8 P2 Q1 R6 S4 T6 U4 V2 W2 X1 Y2 Z1 = **98** (comment says 120).
Muzzy's intended (transcript 2025-12-15-03-16): A9 B2 C3 D4 E16 F3 G2 H6 I9 J1 K2 L5 M3 N7 O9 P2 Q1 R6 S7 T10 U4 V1 W3 X1 Y3 Z1 = **120**. **Q should be a single "Qu" tile** scoring as 1 letter (never implemented). Muzzy: "the bag shouldn't be able to run out."

**Setup — snake draft**: 1-2-2-1 (3p 1-2-3-3-2-1, 4p 1-2-3-4-4-3-2-1). A glyphling goes on a non-edge hex not adjacent to any glyphling. Hands dealt after the draft. Yellow moves first.

**Turn**
1. **Move** one glyphling ≥1 hex in a straight line; can't pass through / land on tiles or glyphlings.
2. **Cast** one tile from the new position along any line, any distance, onto an empty hex. May pass over *own* tiles/glyphlings, not opponents'.
3. **Score** every valid word containing the new tile, on every axis. Word = **length + 1 per own tile in it**. No multipliers or special hexes. Shared letters count for each word. On one axis a word contained in a longer scored word doesn't score (GARDENING yes, DEN no) — but HEL_EA + P scores HELP and PEA. Muzzy's exact rule: filter against the *union* of scored words (SEAL + LEAP both score, ALE doesn't). The C# only checks containment in a single word — may diverge.
4. Scored → draw 1.
5. Didn't score → **cycle**: discard any number, refill to 8. Designer rule: discards set aside, refill, then discards go back to the bag. (CLAUDE.md "up to 3" is wrong.)
6. You must move and cast if you can.

**Hidden score** — running totals hidden during play; only a "+N" preview. "Points are secret in the end."

**Tangle + end** (`Core/TangleChecker.cs`) — a glyphling with no legal move is **tangled**. **Game ends when 2 glyphlings are tangled** (HANDOFF's "one" is wrong). Then for each tangled glyphling, each *opponent* scores **+3 per adjacent tile or glyphling they own**. Highest wins; ties allowed. Self-tangling against own tiles / the edge is a real strategy.

**Dictionary** — `Assets/Resources/words.txt`, 63,656 lines, 907 KB, CSV `WORD,ZIPF` (TWL, abbreviations stripped). Min length 2 (toggle "2-Letter off" → 3). Zipf decides AI vocabulary.

**Modes** — Local 2P / vs AI / AI vs AI / Online / Local 3P / Local 4P. 4P free-for-all (teams cut: "less fun"). AI supports only Yellow/Blue (hard-coded opponent) → vs-AI is 2-player only.

### Known rule bugs in the original (fix in the remake)
- Cycled discards never return to the bag (`HandController.ConfirmCycleDiscard`) — tiles vanish.
- Bag is 98 not 120; no Qu.
- Longest-word filter ≠ Muzzy's union rule.
- Word read direction uses dirs 0/1/2 (N, NE, SE); designer said "left-to-right or top-to-bottom" — verify.
- Host never validates online moves.

## 2. AI opponent identity system
**The goal-selection model lives only on branch `festive-booth`** (commit `facaa5bc`, on GitHub). `main` still runs an older 13-trait weighted-sum AI with 4 personalities. Read with `git show festive-booth:Unity/GlyphtenderUnity/Assets/Scripts/Core/<file>` in `../glyphtender-original`.
Files: `AIGoal.cs` (enums, GoalSelector, TraitRange 0–100), `AIPersonality.cs` (meta/sub-traits, shift config, 7 presets), `AIGoalEvaluators.cs` (7 scorers), `AIBrain.cs` (pipeline); shared: `AIPerception.cs`, `AIConstants.cs`, `TrapDetector.cs`, `ContestDetector.cs`, `SetupDetector.cs`, `AIWordDetector.cs`.

**7 goals, one trait each**
| Goal | Trait | Does |
|---|---|---|
| TRAP | Aggression | hem in opponent glyphlings |
| SCORE | Greed | max points this turn |
| DENY | Spite | block opponent lines / near-words |
| ESCAPE | Caution | keep own glyphlings safe |
| BUILD | Patience | set up future words |
| STEAL | Opportunism | finish opponent partial words |
| DUMP | Pragmatism | shed junk letters |

**A personality** = name + one-liner; min–max range per trait; goal priority order; **meta-traits** (VocabularyModifier added to Zipf threshold; SelfScoreAccuracy / OpponentScoreAccuracy 0–100 — *defined, not wired*; MoraleResponse >50 energised / <50 demoralised); **sub-traits** 0–100 (Endgame, Desperation, Momentum, Pressure, Opportunity, HandQuality); **TraitShiftConfig** per-trait shifts for endgame / desperation.

**Pipeline (`AIBrain.ChooseMove`)**
1. Perceive: hand quality 0–10 (vowel balance, common/hard letters, dupes); glyphling pressure own/opp 0–10 (blocked dirs, escapes, nearby opponents); fuzzy score; momentum (last 5 turns); board fill.
2. Shift trait ranges — difficulty (Apprentice widen 30% & −10 · Archmage narrow 30% & +10); morale (opp scored ≥10 last turn → all ±15); endgame (starts 40% fill, full 80%); desperation (from −5 behind, full −25); danger (own pressure ≥5 → Caution +≤20, Aggression −half); opportunity (opp pressure ≥5 → Aggression & Opportunism +≤20); hand (<4 → Pragmatism up / Greed down ≤15; >7 reverse ≤10); momentum (hot >2 → Aggression; cold <−2 → Caution).
3. Pick goal (`GoalSelector`): walk priority list; per goal roll a threshold inside its trait range, then d100; ≤ threshold wins. All fail → first goal.
4. Generate moves: glyphling × destination × cast hex × unique letter; random cut to 300.
5. Score every move for the **active goal only**: TRAP (opp moves removed ×5; tangle +50 +3/adjacent own; opp ≤2 moves +15; self-tangle allowed if fill >80% and lead >15) · SCORE (points, +2/letter past 4, +3/extra word) · DENY (line block ×3, near opp tiles ×2, near-word denial, junk bonus) · ESCAPE (pressure drop ×5, routes ×2, open dirs ×3, −10 if ≤2 routes) · BUILD (SetupDetector gap/extension/crossing, ×1.5 per own tile near) · STEAL (points +3/opp tile when opp majority, ×1.5 otherwise) · DUMP (junk score, +3 if cast ≥3 from any glyphling).
6. Choose: keep moves within 80% of best (max 8), weighted random.
- Cycle: threshold = `5 − Pragmatism centre/25`; discard up to 4 with junk ≥3.
- Draft: centre + mobility, pull toward opponents by Aggression / away by Caution, spread if low Aggression, random of top 3.
- **Vocabulary**: Zipf ≥3.0 Apprentice (~5k words) / ≥2.0 FirstClass (~20k) / ≥0 Archmage (all) + personality modifier.
- **Fuzzy score perception** (`AIPerception.ScorePerception`, `AIConstants.cs`): confidence 0.1–1, decays 0.05/turn, +0.1 own score, +0.08 seeing opp score; estimate drifts ±3×(1−conf)/turn; perceived lead noise ±20×(1−conf). The AI can be wrong about who's winning — on purpose.

**The 7 presets** (ranges 0–100 · priority · flavour line from code comments)
- **Bully** — "I want to watch you squirm." Aggr 80–95, Spite 60–80, Opp 40–60, Greed 30–50, Caution 20–40, Patience 10–30, Prag 20–40 · TRAP>DENY>STEAL>SCORE>ESCAPE>BUILD>DUMP · vocab +0.5, opp-score accuracy 70, morale 70, endgame Aggr +20. Muzzy tested: "it felt good!"
- **Scholar** — "Did you know 'QUIXOTIC' is worth…" Greed 85–100, Patience 60–80 · SCORE>BUILD>DENY>DUMP>ESCAPE>STEAL>TRAP · vocab −1.0, morale 30, hand sensitivity 80, desperate Greed −20.
- **Builder** — "Just setting up for next turn…" Patience 85–100 · BUILD>SCORE>ESCAPE>DENY>DUMP>STEAL>TRAP · endgame Patience −30, Greed +25.
- **Vulture** — "That was going to be YOUR word." Opportunism 80–95, Spite 70–85 · STEAL>DENY>SCORE>BUILD>ESCAPE>DUMP>TRAP · opportunity sensitivity 90.
- **Survivor** — "You won't catch me." Caution 85–100, Aggr 5–20 · ESCAPE>BUILD>SCORE>DENY>DUMP>STEAL>TRAP · pressure sensitivity 90, desperate Aggr +25.
- **Strategist** — "Two words, one move." Greed 70–85, Patience 65–80 · SCORE>BUILD>DENY>… — code = multi-word specialist, HANDOFF = DENY-first tactician → **open question**.
- **Balanced** — "Whatever works." all 40–70 · SCORE>ESCAPE>DENY>BUILD>STEAL>DUMP>TRAP · morale 50.
No portraits or bios exist — the flavour lines are seed text for bios/taunts.

**Muzzy's intent** (transcript 2025-12-15-03-16): "fuzzy knowledge always. I don't want the AI to just 'know' things." · "Sometimes I think I'm ahead, then I lose track… fuzzy is best. I like some sort of confidence meter." · "slideable scales with fuzzy values to help create several personalities… Not just easy medium hard." · CLAUDE.md: "Don't treat word scoring as primary AI goal (area control first!)". Zone detection and multi-turn lookahead existed only in a Python prototype (inside transcripts) — never ported.
AI pacing: speed Slow 0.5 / Normal 1 / Fast 2 / Instant 5; scripted waits 0.3–1.0 s.

## 3. Screens (all custom 3D-in-world UI, no Canvas; portrait + landscape; `UIScaler.cs`)
- **Main menu**: title, build label, tap-to-cycle rows (Mode, 2-Letter, Board, Blue AI + Lvl, Yellow AI + Lvl), PLAY, Quit.
- **In-game menu** (top-right MENU): AI speed, Input mode (Tap/Drag), Drag offset (0–2), Restart, Quit.
- **Online lobby**: Players 2/3/4, CREATE (6-char code) / JOIN → CONNECT, BACK.
- **HUD**: tilted camera, pinch zoom 100–250%, double-tap zoom, one-finger pan, auto-frame. Turn text ("Your turn" / "Waiting for Player 1") + step prompts ("Place a Glyphling", "Move one of your Glyphlings", "Cast a Runeblossom", "Confirm your turn", "Discard any Runeblossoms"). Hand = bottom row of 8, auto-fit, slide in/out, drag to reorder; cycle mode tap-to-mark. Confirm bottom-right (1.5×), Cancel above it. "+N" preview only. Pink outline on formed words. Legal move/cast highlights, ghost preview, pulsing tangled glyphlings.
- **Every action is preview → confirm.** Tap and drag modes, adjustable finger offset.
- **End screen**: winner / "IT'S A TIE!", stats per player (Final, Tangle pts, Points/turn, Best turn, Longest word, Multi-words, Unique words), View Board / View Stats, Play Again (local) or Rematch 30 s (online).
- Missing: stats/profile (radar chart computed, never drawn), tutorial, audio.

## 4. Pain points
- PROJECT.md: Play Again/rematch issues · 3D UI camera switching weirdness · menu flow needs reorganising.
- Wanted: menu layout, **responsive design for different screen sizes**, hand organising, colour preference, random starting player, AI animates like a human, word-based room codes. Planned fan-curve hand.
- Space: no write-up, but a long trail of layout commits and hand-tuned margins — a 117-hex board vs an 8-tile hand + buttons on a phone.
- Past bugs (mostly fixed): Play Again broke hand state; tangled glyphlings lacked a cue; played letters behind hand in 3–4p cycle; online duplicated glyphlings, ghost tiles, cycle UI on wrong player.
- Muzzy (2026-09-30): "this game functions, but there's LOTS of edge-case issues."

## 5. Online (Unity Gaming Services: Auth + Lobby + Relay + Netcode, host decides)
Messages: GameStart (bag order, hands, board, 2-letter, player count), Turn, DraftPlacement, Cycle, Forfeit, Rematch. 1v1 works cross-network; 3p verified v791. Not done: forfeit, heartbeat ("hangs if a player disconnects"), AI takeover, move validation. Hard-won: relay region explicit; bind before publishing join code; guests wait for full lobby, staggered; relay slots = players−1.

## 6. Other systems
- Settings (`SettingsManager.cs`), stats (`Core/Stats/*`): per-turn history, lifetime stats (wins, words, multi-word turns, cycled, tangles caused/suffered/self, longest, best turn, favourite word). **Radar**: "Wordsmith" (MultiWord, Value, Investment) vs "Tanglesmith" (Trapper, Aggression, Resilience) — never shown.
- Audio: none. Tutorial: none (planned progressive disclosure). Animation: basic tweens; same object travels hand → board.
- **Art** (`Assets/Art`, 109 MB): 104 runeblossom PNGs (A–Z × 4 colours, 2000², glowing vine-wrapped letter in a rounded hex, thick coloured border, dark starry background) + 4 glyphling portraits (cute fuzzy creature with leaf sprouts). Reusable at ~256 px WebP; one letter set + CSS tint could replace the 4 colour copies.
- Visual wishlist (HANDOFF §11): vine letters, 3D glyphling figurines, topiary-growing letters, vine animation on tangled pieces, board themes. Signature cast idea (§11.2): seed flies in an arc → buried in the hex → glyphling splashes magic water → topiary letter grows.

## 7. Old plan
Done: rematch. In progress: 3–4p online. Not started: menu rework, animation system (AI animates like humans, timing in config), user preferences, code quality. Deferred: forfeit/disconnect/heartbeat, vote-replace dropped player with AI, 30 s grace to leave, spectators, async multi-game, accounts, leaderboards, iOS/Steam/itch. AI backlog: lookahead, closed-zone weighting, balance-test all 7, merge festive-booth. PROJECT.md: meant as a "reference implementation and starting point for future game projects."

## 8. The soul — must not lose
- **Area control first**: hunting, tangling, walls, closed "zones" — "closed off areas that only I have access to so I can roam around in there and just score… almost always pays off."
- **Double-duty moves**: "a move that both lets me score… while also interfering with my opponent's positioning?"
- **Junk-letter bullying** — fire a bad letter to block while resetting your hand.
- **Steal half-built words; grow words**: "In > kin > ask > mask > masking".
- **Hidden score + self-tangle gamble**: "I've ended games by tangling my own glyphling because I thought I was ahead, only to find out that I wasn't, and lost!"
- **Plan the kill** — tangle an opponent surrounded by *your* tiles.
- **Threatening AI** — "make players feel hunted"; distinct, human-feeling personalities.
- **Board-game feel** — cozy, "bubbly and satisfying", arcs and pauses so players follow what happened.
- **Preview-then-confirm**; tap and drag.
- **Snake draft** — no opening lockout ("an initial volley that locks the opponent out of an entire side of the board").
