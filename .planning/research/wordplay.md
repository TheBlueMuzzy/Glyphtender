# Word Play (GMTK, 2025) — feel & visual reference for Glyphtender

> Researched 2026-09-30. Sources are linked. Tags: **[src]** = stated by a source · **[seen]** = I looked at it myself (11 Steam screenshots + the 64-second Steam trailer, frame by frame at 5 fps) · **[inferred]** = my reading, not confirmed.
> No devlog video transcript was reachable, and Mark Brown's written posts say little about animation, so the motion notes below come mostly from the trailer frames.

## Summary
Word Play is Mark Brown's (Game Maker's Toolkit) "Balatro meets Scrabble/Boggle" roguelike: 16 letter tiles in a grid, spell the best word, score letters + length bonus, pick perks between rounds ([Steam](https://store.steampowered.com/app/3586660/Word_Play/), [How I Made Word Play](https://gmtk.substack.com/p/how-i-made-word-play)). Very Positive on Steam (89%). Brown aimed for a "slick, clean, minimalist style… like a video game version of a GMTK video". He added "animations, more colour, and juicy numbers", turned down suggestions of cartoon mascots, and chose "smaller, easier to digest numbers" rather than Balatro's huge synergies ([Substack](https://gmtk.substack.com/p/sorry-i-stopped-posting-but-i-made)) **[src]**.

What's worth taking: **white letter tiles you can always read, on a single-colour gradient that changes per mode** · **a score that is built tile by tile, in two parts, into a pill-shaped counter** · **physical tile sounds** · **card-style menus with a little shine**. What's not worth taking: the slot-machine pacing and the pressure of chasing a target score.

## Look
- **Palette: one saturated hue per screen/mode.** Backgrounds are a single-hue gradient with a faint diamond/dot texture: royal blue (Hard), magenta/crimson (Legendary, special rounds), emerald→teal (Marathon, Quick Play), orange→red **[seen]**. A reviewer: "bright, white letters… pop out nicely from the background, which is just a gradient" ([Indie Times](https://theindietimes.org/i-have-many-words-to-say-about-gmtks-word-play/)) **[src]**. So the colour tells you *where* you are, and the tiles never change colour to do it **[inferred]**.
- **Tiles:** off-white rounded squares with a darker bottom lip (they read as physical and a bit raised), a heavy black geometric sans capital, and a small point value in the top-right corner **[seen]**. Special tiles swap the face colour (gold, emerald, cyan, red) and get "a shine effect" **[src]**. After colour-blind feedback, Emerald tiles got a symbol so they aren't confused with Golden (patch 1.04) ([news](https://steamcommunity.com/app/3586660/allnews/)) **[src]**. Colour is never the only signal.
- **Ghost letters:** when a tile leaves the grid, its letter stays behind as a dim, same-hue ghost in the empty slot, so you can see where everything came from **[seen]**. Unused word slots show their bonus ("+5", "+10", "+15") as a dim preview, and they turn into bright orange tags once a tile fills them **[seen]**.
- **Typography:** one rounded, heavy sans for everything (tiles, UI, cards). Numbers are bold and white in dark pills **[seen]**. Accessibility adds three dyslexia fonts, high contrast, highlighted vowels and spelling suggestions **[src]**.
- **Chrome is flat and quiet:** a thin top bar (mode · score/target · round), a thin bottom bar that doubles as a progress bar ("PLAYS"), perks down the left, gifts down the right, round tool buttons (delete, refresh, bag, submit) in one column next to the grid **[seen]**. The Indie Times describes the same layout **[src]**.
- Icons instead of illustrations for 160 perks, a deliberate scope cut ([How I Made](https://gmtk.substack.com/p/how-i-made-word-play)) **[src]**.

## Motion & juice
Everything below is **[seen]** in the trailer unless marked. Timings are estimates from 5 fps frames.
- **Tiles land one at a time.** Title and interstitial words ("WORD PLAY", "SCORE BIG!", "STAY ALIVE.") build letter by letter. Each tile drops or flips into its slot about 0.1–0.2 s after the one before, with a slight tilt that settles.
- **Placing a tile in the word row** lights the orange bonus tag above that slot, and the tile sits a little lifted.
- **Scoring works like a conveyor belt** (see next section): the tiles pop up and leave, left to right, and each slot keeps its number behind.
- **Perk cards light up** (they flash white) in the sidebar at the moment they add to the score. The trailer zooms in on "If Same Letters Together ×1.5" as it fires.
- **The counter pops.** The digit that just changed is drawn bigger and brighter for a beat. A white glow ring pulses round the pill when a multiplier lands.
- **Perk-choice cards** deal in from below, overlapping and slightly rotated, then fan out into three.
- **No screen shake or particle storms were visible** **[seen, limited sample]**. The game gets its punch from sequencing, pops and sound, not from violence. This fits Brown's "classy" goal **[inferred]**.
- **Sound:** "the sounds you hear when shuffling around your tiles, spelling words, and refreshing do a perfect job of capturing the real-life sounds that a bag of Scrabble tiles make". The music (Zach Jones, 9 tracks) is "laid-back, chill, and catchy" and Wii-era in feel ([Indie Times](https://theindietimes.org/i-have-many-words-to-say-about-gmtks-word-play/)) **[src]**. PC Gamer: the music balances "jazzy catchiness and ambient contemplation" **[src, via search summary]**. The sound designer was hired after sending an unsolicited spec video ([Substack](https://gmtk.substack.com/p/sorry-i-stopped-posting-but-i-made)) **[src]**.

## Scoring reveal
The frame-by-frame sequence for ATTEREH… (Hard mode) **[seen]**:
1. A **two-part pill** appears above the word: navy left half = letter points, orange right half (dotted texture) = bonus points. It starts at "1 + 0".
2. The tiles leave **one at a time, left to right**, each popping up with a quick flip. The tile's letter value moves into the left half (1 → 4 → 5 → 6 → 7…) and its slot bonus into the right half (+5 → +10 → +15 → +25 → +35). **Each slot keeps its number behind** in teal or orange, so the board turns into a receipt.
3. **The perks fire one by one**: the sidebar card flashes and the number it touches goes up (12 + 35 → 12 + 41).
4. **The halves merge**: the pill shrinks into one number (53) and turns **green**.
5. **The multipliers go last**: the ×1.5 perk flashes, the number jumps to 80, and a white glow ring pulses round the pill.
6. The total drains into the top "86 / 330" counter.
The whole thing takes about 5 s for a 10-letter word. Addition always comes before multiplication, and each step has its own place on screen, so a player can follow the maths without reading a rule **[inferred]**. The end screen is a simple card: "You Win! · Words Spelled 57 · Perks Purchased 11 · Best Word: TERRORISING – 450" **[seen]**.

## Menus & UI
- **Round complete:** the board dims, a pill banner reads "Round 3 Complete" with a red "+3 Plays" chip, and three perk **cards** appear. Each card has a coloured header for its type (yellow Upgrade, blue Modifier, red Gift), an icon, short rules with the key words coloured, and a rarity footer (Common/Uncommon/Rare). Under them sit pill buttons whose cost chip is built in ("Re-Roll | −2 Plays", "Skip | +2 Refresh") and an eye button to peek at the board **[seen]**. Players can peek at the bag or board while choosing ([How I Made](https://gmtk.substack.com/p/how-i-made-word-play)) **[src]**.
- **The letter bag** is an overlay drawer on the right: a grid of every tile, with used ones dimmed **[seen]**.
- **Special rounds** show a pill banner above the word row in the mode colour ("Special Round: First Tile Is Locked") **[seen]**.
- **Cards feel real:** "the little bit of shine and texture on them makes them feel like real, actual playing cards" **[src]**.
- Patches kept tidying readability: clearer highlighted words in special rounds, clearer special tiles in the bag and in high contrast ([news](https://steamcommunity.com/app/3586660/allnews/)) **[src]**.

## Onboarding
- **Easy mode is the tutorial.** The store page says Easy is where you "learn the ropes", and there is a casual Quick Play (one modifier at a time, "Next Round in 4 Words", bronze/silver target) ([Playtester](https://playtester.io/word-play)) **[src]** **[seen]**.
- **Tips appear when the player makes a mistake.** For example, patch 1.06 added "tutorial message if player clicks, but doesn't hold, on refresh button" **[src]**. A tip shows up at the moment of the mistake, not in a lesson at the start.
- **The game doesn't punish mistakes it could have prevented.** Early builds penalised misspellings; playtesters hated this, especially non-native speakers and dyslexic players, so it was removed ([Substack](https://gmtk.substack.com/p/sorry-i-stopped-posting-but-i-made)) **[src]**.
- Three input methods (click, drag, type) and forgiving controls: rearrange tiles, controller, touchscreen (1.08) **[src]**.

## What players praise / criticise
- **Praise:** "UI feeling a lot more refined and crispy" than other Scrabble-likes; "slick design"; "The art and controls are a joy to interact with"; "graphics, music and sound effects are all well done"; "no time pressure"; good for winding down with a partner; "nothing is as satisfying as writing a word with the perfect length and all the power-ups stack together" ([Steam reviews](https://store.steampowered.com/app/3586660/Word_Play/#app_reviews_hash)) **[src]**. Demo: "Easy to read, easy to understand" ([demo thread](https://steamcommunity.com/app/3586660/discussions/0/601905246717901820/)) **[src]**.
- **Criticism:** "Instead of looking like an early mobile game I wish the animations were more impactful" (one negative review); "barebones"; the soundtrack is short and repeats; balance depends on luck with perks; the dictionary is missing words; the Enter key didn't submit in the demo ([Indie Times](https://theindietimes.org/i-have-many-words-to-say-about-gmtks-word-play/), reviews, [PC Gamer](https://www.pcgamer.com/games/roguelike/i-spent-2025-digging-through-all-the-word-game-roguelikes-flooding-steam-to-see-if-any-could-capture-balatros-magic-here-are-the-highly-scientific-results/)) **[src]**. The minimal style splits people: most call it crisp, a few call it flat.

## What to steal for Glyphtender
1. **Seed throw — tiles land in sequence.** When the tray deals or refills, seeds drop in one at a time, about 80–120 ms apart, with a small tilt that settles. Stagger and tilt go in `content/feel.json`.
2. **Sprout — a physical, textured sound.** The Scrabble-bag clack translated for us: a soft earthy *thup* when the seed lands and a leafy rustle as the topiary grows. Nothing synthetic and beepy. Use 3–4 pitch variants.
3. **Tray — seeds are always cream tiles with dark letters.** Ownership and state are shown only by rings and halos (already our piece-state rule), never by recolouring the letter. That keeps them readable on a night background.
4. **Tray — preview before commit.** Word Play's dim "+5 / +10" slot previews match our "live Magic preview on the Cast button". The idea to steal: while a seed is planned, dimly outline the words it *would* grow on the board, then brighten them on cast.
5. **Word made — trace the word left to right.** Light up each letter in the word in reading order, about 60–90 ms per letter, so the eye follows the spelling. Two words on different leylines trace one after the other.
6. **Word made — ownership adds a second beat.** A two-part build like Word Play's pill: first "letters" count up, then "+1 per own seed" pops on each owned letter in the player's colour. It teaches the scoring rule without text. Shown privately to the current player, because Magic is secret.
7. **Word made — leave a mark on the board.** Like the slot numbers Word Play leaves behind, a word keeps a faint glow-vine along its hexes for a moment, so everyone can see *what* grew even though they can't see how much Magic it made.
8. **Magic reveal — a fixed order of stages, each with its own place on screen.** Word Magic first, then tangle bonuses, then the total. Each stage has a spot on screen and a beat of silence before the next. Merge them into one number and change its colour (their pill going navy/orange → green) for the final total.
9. **Magic reveal — the thing that scores lights up when it scores.** Word Play flashes each perk card as it fires. We flash each tangled glyphling (and its neighbouring seeds) when its tangle bonus is counted.
10. **Magic reveal — the digit that just changed pops.** Scale the changed digit up to about 1.2× for a beat, and pulse a soft glow ring on the final number. Don't shake anything.
11. **Tangle — a gentle banner, not an alarm.** Their "Special Round: …" pill banner in the mode colour → a soft pill: "Blue is tangled 🌿" (moonlight colour, eases in, holds, fades).
12. **Menus — cards with a coloured header, an icon, key words coloured and a small shine.** This suits game setup (board size, seats, AI personality). The Game UI kit Cozy cards could get a subtle paper grain + sheen.
13. **Menus — put the cost inside the button.** "Re-Roll | −2 Plays" → "Refresh | skip your draw". Players see the trade-off before they tap.
14. **Background — one hue per context.** Keep the night garden, but tint the sky gradient per phase (setup = dusk violet, play = deep indigo, reveal = moonlit teal) so players always know where they are.
15. **Onboarding — tips triggered by mistakes, never penalties.** For example, if someone taps a seed but never casts, show a one-time tip. A word that's not in the list just doesn't grow. It costs nothing.

## What NOT to copy
- **Score-chasing tension.** A target score, "Plays" running out and a red progress bar create pressure to perform, which goes against **"A cozy garden"** and against "not a vocabulary exam". We have no target, no timer and no fail state mid-game.
- **Numbers after every word.** Word Play shows the score after every play. Our Magic is **secret** until the reveal, so public feedback per word must show *what grew*, not *how much Magic*. Otherwise we lose the Secret-Magic tension.
- **Letter values and multipliers.** Our pillar "the best speller doesn't always win" rules out point values on seeds and ×1.5-style combo tiers. Don't put little corner numbers on our seed tiles.
- **Saturated, flat, arcade colours.** Their bright magenta/emerald floods would fight a night garden. Borrow the *rule* (one hue per context, white text on top), not the colours.
- **A 5-second reveal after every turn.** In a 2–4 player game, that's time everyone else spends waiting (our GDD watch-out). Keep the per-turn "word made" moment under about 1.5 s and save the long, staged sequence for the one end-game Magic reveal.
- **Minimalism taken as far as they did.** A few players found it "early mobile game" flat. Our topiary and glyphlings should carry the charm that Word Play left out on purpose.

## Ideas for BMUZ style guides
Written up separately: `~/.claude/config/bmuz/reviews/2026-09-30-glyphtender-remake/wordplay-style-ideas.md` (juice ladder, reveal pacing rules, dark-theme colour rules, feedback layering).
