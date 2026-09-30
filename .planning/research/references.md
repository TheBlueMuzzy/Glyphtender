# Glyphtender web: reference research (/discover)

Date: 2026-09-30. Purpose: learn from games that already solved Glyphtender's problems (two-step turns, hex boards on phones, rack plus board, pass-and-play, hidden scores) before we design the web UI.

**How sure we are:** each section says where it comes from. **[src]** means a linked source backs it. **[known]** means it comes from general knowledge of the app and should be checked hands-on before we lock anything. Search results for the phone word-game UIs were thin, so most claims in section 3 are [known].

---

## 1. Game of the Amazons (the structural ancestor)

**Rules parallel:** in Amazons you move a queen-like piece, then shoot an arrow from its new square along a queen line. That arrow blocks the square for good. The last player able to move wins. [src: [Wikipedia](https://en.wikipedia.org/wiki/Game_of_the_Amazons)]. In Glyphtender the tile you cast is the arrow, and being tangled is the same as having no moves. The differences: Glyphtender has scoring, a hand of letters, and it ends after 2 tangles instead of one.

- **Feel:** a slow squeeze, with "walls closing in" tension and a sharp moment of realising "that region is mine."
- **Do:** players cut the board into sealed regions with their arrows and fight over who owns the most empty space.
- **Rules that cause it:** arrows are permanent and pieces move any distance in a straight line. Together these make every shot a wall.
- **How Amazons AIs judge a position** (directly useful for our "closed zone" heuristic):
  - **Territory by min-distance.** For each empty square, count how many queen moves each side needs to reach it. Whoever gets there faster "owns" it. [src: [Lieberum, An Evaluation Function for Amazons](https://link.springer.com/content/pdf/10.1007/978-0-387-35706-5_19.pdf); [Hensgens thesis](https://project.dke.maastrichtuniversity.nl/games/files/msc/Hensgens_thesis.pdf)]. Engines also compute king-move distance (one step at a time) as a finer tiebreak.
  - **Mobility.** Count my legal moves minus the opponent's. [src: [ResearchGate eval paper](https://www.researchgate.net/publication/223117177_An_evaluation_function_for_the_game_of_amazons)]
  - **Weighting by game phase.** Territory, position and mobility matter different amounts early and late. Mobility dominates the opening and territory dominates the endgame. [src: [MDPI Algorithms 17(8) 334](https://doi.org/10.3390/a17080334)]
  - **"Defective territory."** A sealed region can hold fewer usable moves than it has empty squares. [src: Wikipedia]
- **Steal:**
  - Build the AI heuristic from queen-distance ownership (a 3-axis hex version) plus a mobility difference, with weights that shift as the board fills.
  - Detect sealed regions with a flood fill. A glyphling alone in a sealed region can count its remaining moves exactly.
- **Avoid:** measuring a closed zone by counting hexes. Our moves are straight lines that cannot pass through anything, so defective regions will be common. Count reachable moves instead.

## 2. Hive (official app / BGA) and Santorini (official app)

**Hive** [src: [BGA Hive app news](https://en.boardgamearena.com/news?id=408), [BGG thread](https://boardgamegeek.com/thread/1076392/hive-available-on-board-game-arena), [App Store](https://apps.apple.com/us/app/hive-game/id6747834729)]
- **Feel:** tactical, like a puzzle. You are always one move from being surrounded.
- **Do:** tap a piece to see where it can go, then tap a highlighted destination.
- **UI:**
  - The hive has no board, so it grows and drifts, and players complained that pieces scrolled off-screen on BGA web, which has no in-game zoom.
  - The dedicated app added pinch-zoom.
  - The newer official app puts **Undo** front and centre ("learn, experiment, improve without pressure") and adds haptics.
  - Some players asked for a faint grid of empty hexes to be shown.
- **Steal:** tap-to-select, then show every legal destination at once. Show a faint empty-hex grid; Glyphtender has a fixed board, which is an advantage here. Use a haptic tick when you commit.
- **Avoid:** a board that can drift off-screen without auto-fit.

**Santorini (Roxley / Dire Wolf app)** [src: [Meadow Party](https://meadowparty.com/blog/2019/12/03/santorini-app/), [Pocket Gamer](https://www.pocketgamer.com/santorini/santorini-review-the-ambrosia-of-digital-boardgames/), [8bit Meeple](https://8bitmeeple.com/review/santorini/)]
- **Feel:** clean, quick, and "I can see everything I'm allowed to do."
- **Do:** select a worker, tap where it moves, then tap where it builds.
- **UI:**
  - Every legal move and build is marked, so you never wonder whether something is allowed.
  - Undo is only offered for about **2 seconds**, before the AI responds. Reviewers disliked this because you often spot your mistake later.
  - The 3D isometric camera made it too easy to tap the wrong space. The reviewer switched to top-down to play accurately.
- **Steal:** the move-then-build flow: highlight legal moves, then highlight legal builds from the new spot. This matches Glyphtender's move-then-cast exactly.
- **Avoid:**
  - Timed undo windows.
  - Tilted 3D cameras. A flat top-down hex view is the more accurate one on phones.

## 3. Phone word games: Scrabble GO, Words With Friends 2, Wordfeud, Letterpress

[src: [Scrabble GO help](https://scopely.helpshift.com/hc/en/28-scrabble-go/section/1671-new-player-guide/), [WWF2 help / Word Strength](https://zyngasupport.helpshift.com/hc/en/63-words-with-friends-2/section/740-game-guides/), [word-grabber WWF buttons](https://www.word-grabber.com/online-word-games/press-the-right-words-with-friends-buttons)]; the rest is [known].

- **Feel:** "Ooh, how many points is that?" The fun of fiddling before you commit.
- **Do:** drag tiles from the rack onto the board, rearrange them, read the score bubble, then press Play.
- **Rules and UI that cause it:**
  - **Portrait is the default for all of them** [known]. The square board sits at the top at full width. Below it is a fixed rack (7 tiles) with a button row: Shuffle, Swap/Exchange, Pass, Play. Landscape is usually unsupported or treated as secondary.
  - **Live score preview.**
    - WWF shows a small score badge on the pending word as you place tiles. It can be toggled, and it began as an option. [src: word-grabber]
    - WWF2's "Word Strength" compares your pending word's score with the best possible move. [src: Zynga help]
    - Scrabble GO shows the pending score, and the Play button tells you whether the word is valid [known].
  - **Zoom on place.** Scrabble GO zooms the camera in when you place a tile, and this can be switched off in the in-match menu. [src: Scrabble GO help]. Wordfeud and WWF also auto-zoom around a placed tile and zoom out on a double-tap [known].
  - **Recall / shuffle.** Every one of these apps has a "recall all" (tiles fly back to the rack) and a shuffle [known].
  - **Swap / exchange** opens a modal where you tap the tiles to exchange, and it costs your turn. [src: WWF buttons page]
  - **Invalid words.**
    - The modern apps give feedback *before* you commit: the Play button is disabled or turns red, or tiles turn red.
    - Older Wordfeud-style apps give a "not a valid word" toast on submit and you lose nothing.
- **Letterpress** [known]: a 5x5 grid, with the word being built shown in a strip above it. Board ownership is shown only by colour; there is no separate score UI.
- **Steal:**
  - Drag *and* tap-to-place.
  - A pending-move score badge next to the new tile.
  - A Play button that shows the score and whether the move is valid (e.g. "Cast · +7" or "No word · Swap?").
  - Recall and shuffle as one-tap buttons.
- **Avoid:**
  - Forced auto-zoom that yanks the camera. If we zoom at all, make it gentle, make it a setting, and keep it off when the whole board already fits.

## 4. Pass-and-play on one device

[src: [BGA hotseat news](https://en.boardgamearena.com/news?id=359), [BGA forum](https://forum.boardgamearena.com/viewtopic.php?t=19692), [TouchArcade TtR pass-and-play](https://toucharcade.com/2011/07/12/ticket-to-ride-gets-pass-and-play-in-latest-update/), [Carcassonne Meeple Mountain](https://www.meeplemountain.com/reviews/carcassonne-android-app/)]

- **Feel:** a party at the table. "Don't look!" is part of the fun, but waiting while someone else plays is dead time.
- **Do:** finish your turn, hand the device over, and the next player taps to reveal.
- **UI:**
  - BGA hotseat shows a blank hold screen between turns that names who is up next. You tap to reveal.
  - Ticket to Ride shows a popup that hides the tickets until OK is pressed, and plays a sound when it is safe to look.
  - Carcassonne has no hidden hand, so it skips the handoff screen entirely.
- **Steal:**
  - A "Pass to [name/colour]" screen with that player's colour filling the screen and a big "I'm [name], show my tiles" button.
  - **The board stays visible** behind it (the board is public). Hide only the hand and any personal info.
  - A sound or haptic when the hand is revealed.
- **Avoid:**
  - A handoff screen when there is only one human, e.g. vs AI. Skip it.
  - A handoff screen when every player agrees hands are public. Make it a table setting ("Hide hands: on/off").

## 5. Responsive layouts across orientations

[src: [lichess mobile issue #2992](https://github.com/lichess-org/mobile/issues/2992), [lichess landscape forum](https://lichess.org/forum/lichess-feedback/landscape-mode-mobile-app), [maia-chess landscape issue](https://github.com/Dash1971/maia-chess-android-preview/issues/29), [BGA mobile guide](https://en.doc.boardgamearena.com/Your_game_mobile_version), [Wingspan Meeple Mountain](https://www.meeplemountain.com/reviews/wingspan-digital/)]

- **Feel:** "The board is big enough to tap accurately." That is the only thing that matters.
- **Pattern: portrait.** The board is at full width with thin info bars above and below. chess.com and lichess stack clock, board, clock [known].
- **Pattern: landscape.** Secondary information goes *beside* the board; the goal is "make effective use of horizontal space." Board size in landscape is the #1 complaint, and title bars eat it (lichess users want fullscreen).
- **Key lesson from lichess #2992:**
  - The layout was chosen by *size* ("shortest side > 600dp = tablet"). Foldables that are nearly square then got a cramped side-by-side layout.
  - The fix is to choose by **aspect ratio**, not by device class.
- **BGA:**
  - "Autoscaling is not a substitute for adapting your interface."
  - Scaling the whole page is discouraged because it hurts legibility.
  - Don't hide information behind hover.
  - Use Pointer Events.
  - Use `touch-action: none` only on the board.
- **Wingspan:** the hand sits bottom-left and cards lift when highlighted. The UI "gets crowded with a big hand" and it is "not always clear what the game wants you to click."
- **Steal:**
  - Pick the layout from the aspect ratio of the free area.
  - Board auto-fit is the default; pinch-zoom is optional.
  - Handle safe areas with `env(safe-area-inset-*)`.
  - Use `100dvh`, not `100vh`.
- **Avoid:**
  - Title and menu bars in landscape.
  - Relying on pinch-zoom as the main way to fit the board.

## 6. Confirm button vs undo-until-end-turn

[src: [Root Steam thread](https://steamcommunity.com/app/965580/discussions/0/603032578938675505/), [Dire Wolf Root patch 1.31.3](https://news.direwolfdigital.com/root-patch-1-31-3-fast-forward-to-fun/), [UX Planet on confirmations](https://uxplanet.org/confirmation-dialogs-how-to-design-dialogues-without-irritation-7b4cf2599956), Santorini sources above]

- **Industry rule (Dire Wolf, stated explicitly):**
  - Undo is allowed freely *until an action reveals new information*, such as a card draw or a die roll. After that it is locked.
  - Players asked for "either undo or confirm, always one of the two." Root's undo button used to vanish in confusing ways; a patch now hides it only when undo is truly impossible.
- **General UX:** for reversible actions, "do it, then offer undo" beats "are you sure?" dialogs. Dialogs interrupt the flow and train players to click through without reading.
- **BGA convention [known]:** many games make you act and then press a final "Confirm / End turn" button, with an undo available up to that point.
- **Glyphtender fit:**
  - Moving and casting reveal nothing, so both can be undone freely.
  - Drawing new tiles *does* reveal information, so that is the natural commit point.
  - So there should be **one** commit ("Cast" / "End turn"), not a confirm on every step. The Unity version's preview → confirm on every action doubles the number of taps.
- **Avoid:** timed undo (Santorini) and undo that appears and disappears without explanation (early Root).

## 7. Hidden scores and dramatic endings

[src: [TtR Steam scoring thread](https://steamcommunity.com/app/2477010/discussions/0/599638390296604975/), [BGA TtR help](https://en.boardgamearena.com/doc/Gamehelptickettoride)]

- **Feel:** "I think I'm winning... am I?" Then the gasp at the reveal.
- **Ticket to Ride:**
  - Route points are public. Tickets are hidden and scored at the end, and incomplete tickets subtract points.
  - The digital version shows ticket results at the end, but players complain the longest-route bonus "flashes by too fast." They asked for each ticket's route to be animated for each player, with a skip button.
- **Wingspan / Splendor [known]:**
  - Wingspan's digital end screen counts up category by category (birds, bonus, end-of-round, eggs, and so on), so the lead can change hands mid-reveal.
  - Splendor's scores are public, so it has no drama at the reveal. That is the counter-example.
- **Steal:** a staged, skippable reveal:
  1. Show each tangled glyphling and play its surround bonus (+3 per adjacent own piece) as it pops.
  2. Then count up each player's total, one player at a time, lowest first.
  3. Then highlight the winner.
- **Avoid:** a score screen that appears all at once, and bonuses that flash by too fast to understand.

---

## Recommendations for Glyphtender web

1. **Choose the layout by the aspect ratio of the free area, not by device.** If the screen is taller than wide (ratio ≥ 1.15), use a stacked layout. Otherwise put the tray beside the board. Near-square screens get the stacked layout. *(lichess #2992, BGA guide)*
2. **Portrait:** a thin status bar on top (whose turn, their colour) → the board, auto-fit to full width → a fixed hand tray at the bottom (8 tiles in one row, about 44px minimum each) → an action row (Recall · Shuffle · Swap · Cast). *(Scrabble GO / WWF / Wordfeud, chess.com)*
3. **Landscape:** the board fills the left side at full height. On the right sits a vertical tray: a 2x4 grid of tiles plus the action buttons, on the dominant-thumb side with an option to swap sides. No title bar. *(lichess landscape feedback, Wingspan crowding)*
4. **Auto-fit is the default, pinch-zoom is optional.** 85–117 hexes fit on a phone at around 30–36px per hex. The camera should always show the whole board. Pinch and double-tap are only for a closer look, and a "fit" button snaps back. Never auto-zoom on tile placement unless the player turns it on. *(Hive drifting-board complaint, Scrabble GO zoom toggle)*
5. **Flat top-down 2D hexes, no tilted camera.** Keep it tap-accurate. *(Santorini isometric misclicks)*
6. **Highlight everything that's legal at every step.** Select a glyphling → highlight its reachable hexes. Move → highlight the hexes you can cast to. Pick a tile → show the legal cast hexes, each with a small preview score. *(Santorini, Hive)*
7. **One commit per turn, with free undo before it.** Moving and casting are tentative and each can be undone with Undo or by tapping them again. **"Cast"** is the only confirm, because drawing tiles reveals new information. Drop the Unity version's confirm on every step. *(Dire Wolf Root undo rule, UX Planet, BGA convention)*
8. **Support both tap-tap and drag, all the time.** Tap-tap is precise on small hexes; drag feels good. Show a lifted-tile "ghost" under the finger that sits slightly above the touch point, so the finger doesn't hide it. *(Scrabble GO / WWF)*
9. **Live pending-move feedback on the Cast button.** Show "Cast · +7 (GLYPH, TEND)" when the move scores and "Cast · no word" when it doesn't. Outline the scoring words on the board. This shows the score of the move only, never the running total, so the hidden-score rule stays intact. *(WWF score bubble / Word Strength)*
10. **Non-scoring casts are allowed, so no red "invalid word" error.** This is an area-control game. Say it neutrally ("no word · you may swap after"), and move straight to the discard-and-refill step. *(word-game invalid feedback, adapted to Glyphtender's rules)*
11. **Swap is a mode inside the tray, not a modal.** Tiles become toggleable, and the button reads "Swap 3 · Done". *(WWF swap)*
12. **Pass-and-play handoff screen** in the next player's colour, with "Pass to Ana → tap to show your tiles". The board is dimmed but visible; only the hand is hidden. Skip the screen vs AI or when "hide hands" is off. Play a haptic or sound on reveal. *(BGA hotseat, TtR pass-and-play)*
13. **Show tangle danger, not scores.** Mark glyphlings with 0–1 moves left using an outline or pulse for every player. The tension then comes from what the board shows rather than a scoreboard. *(Amazons mobility; Hive "surround" awareness)*
14. **Staged end reveal:** tangle bonuses pop hex by hex (+3), then each total counts up one player at a time, lowest first, then the winner. Each step can be skipped and the pace is slow enough to read. *(TtR complaints, Wingspan count-up)*
15. **Technical basics for the layout:**
    - Use `100dvh` and `env(safe-area-inset-*)`.
    - Use Pointer Events.
    - Put `touch-action: none` only on the board.
    - Show no info on hover only.
    - Make touch targets at least 44px.
    - Put tray sizes and hex sizes in `content/` JSON.

    *(BGA mobile guide)*

**AI heuristic note (for the TDD):**
- Score each position as a weighted sum of:
  - hex-queen-distance territory,
  - the mobility difference,
  - a count of each glyphling's reachable moves in its sealed region (flood fill).
- Mobility matters most early and territory matters most late.
- Count moves, not hexes, because of defective regions.

*(Lieberum; Hensgens; MDPI 2024)*
