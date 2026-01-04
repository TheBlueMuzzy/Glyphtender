# The Glyphtender's Trial - Project Context

## User Commands
Quick commands the user can say:
- **"commit"** - Stage all changes and commit with descriptive message
- **"look at handoff"** or **"check handoff"** - Read HANDOFF.md for full Claude Chat context
- **"status"** - Show git status and summary of current work
- **"push"** - Push commits to remote

---

## Project Vision

> **"This is an area control game with a spelling element, not a spelling game with area control."**

This distinction is critical. The game is NOT Scrabble with hexagons. Every design decision — especially AI behavior — must reinforce territorial pressure and spatial strategy as the primary gameplay layer, with word-forming as the tool players use to execute that strategy.

**The experience Muzzy wants:**
- **Cozy but strategic** — Animations "bubbly and satisfying," deliberate pacing
- **Board game aesthetic** — Feels like a beautiful physical board game, not a mobile puzzle app
- **Threatening AI** — Players should feel hunted, pressured, worried about their Glyphlings' safety
- **Mobile-first** — Touch interactions (tap and drag both supported)

---

## Claude Code Session Process

### At Session Start
1. Read this file (CLAUDE.md) for project context
2. Check `HANDOFF.md` if user mentions "look at handoff" or starts with context from Claude Chat
3. Review recent git commits to understand recent changes

### At Session End (Before Each Commit/Push)
1. Update the "Current Status" section if major features were added
2. Update "Known Issues" if bugs were found or fixed
3. Add any important implementation details discovered
4. If significant decisions were made, note them in "Recent Decisions" section below

### When Updating CLAUDE.md or HANDOFF.md
**IMPORTANT:** These files exist in both the worktree and the main repository. After editing:
1. Edit the file in the current worktree (where you're working)
2. **Copy to main repository:** `cp <worktree>/CLAUDE.md C:\Users\Muzzy\Documents\UnityProjects\Glyphtender\CLAUDE.md`
3. Same for HANDOFF.md if updated
4. Commit and push changes

The main repository location is: `C:\Users\Muzzy\Documents\UnityProjects\Glyphtender`
This ensures both locations stay in sync.

### Handoff File
Location: `HANDOFF.md` (same folder as this file)
- Created by Claude Chat with comprehensive context about vision, goals, and decisions
- Contains detailed game rules, AI design philosophy, roadmap, and backlog
- Read this when user says "look at handoff" or "check handoff"

---

## Codebase Documentation
**All code files are comprehensively documented** with file headers explaining:
- File purpose and responsibilities
- Key classes and their roles
- Architecture relationships
- Input/output flow where relevant

When exploring unfamiliar code, **read the file header first** - it provides context anchoring.

---

## Game Rules (Quick Reference)

### Turn Structure
1. **Move** one Glyphling at least 1 hex along a leyline (cannot pass through tiles or other glyphlings)
2. **Cast** one letter tile from hand along any leyline from NEW position
   - Can pass over YOUR tiles, but NOT opponent's tiles or any glyphlings
   - Must land on empty hex
3. **Score** any valid words containing the newly-placed tile
4. **Draw/Cycle:** If scored → draw 1 tile. If not → may discard any tiles, then refill to 8

### Scoring System
- **Base Points:** Word length (number of letters)
- **Ownership Bonus:** +1 for each of YOUR tiles in the word
- Example: "HELP" (4 letters) with 2 of your tiles = 4 + 2 = 6 points
- **Multi-word:** If placing creates words on DIFFERENT leylines, score each separately
- **Same-leyline:** Only score LONGEST valid word on a single leyline
- **Tangle:** Opponent scores 3 points per THEIR adjacent tile when your glyphling is trapped

### Snake Draft Placement
Instead of fixed starting positions, players draft Glyphling placements:
- **2P:** P1 → P2 → P2 → P1
- **3P:** P1 → P2 → P3 → P3 → P2 → P1
- **4P:** P1 → P2 → P3 → P4 → P4 → P3 → P2 → P1

Rules: Cannot place on perimeter hexes. Cannot place adjacent to ANY other Glyphling.

### Board Sizes
| Board | Columns | Hexes | Layout |
|-------|---------|-------|--------|
| Large | 13 | 106 | [5,7,8,9,10,9,10,9,10,9,8,7,5] |
| Medium | 11 | 85 | [4,7,8,9,10,9,10,9,8,7,4] |

### Leylines (Flat-Top Hexes)
3 axes / 6 directions:
- **Vertical:** Up / Down
- **Diagonal Ascending:** Down-Left / Up-Right
- **Diagonal Descending:** Up-Left / Down-Right

There is NO true horizontal leyline — this is intentional.

---

## AI Design Context

### Goal-Selection Model (IMPLEMENTED - Phase 4 Complete)
The AI now uses a **goal-selection model** instead of weighted scoring:
- **7 Goals:** TRAP, SCORE, DENY, ESCAPE, BUILD, STEAL, DUMP
- **7 Traits (0-100 scale):** Aggression, Greed, Spite, Caution, Patience, Opportunism, Pragmatism
- **Priority Cascade:** Roll d100 against each goal's trait in priority order; first success activates
- **Goal-Specific Evaluation:** Moves scored ONLY for active goal's criteria

This creates personality-driven behavior where a Bully ignores great words because TRAP activated.

### What "Threatening" Looks Like
- Block opponent's movement paths
- Box opponents toward tangle situations
- Deny access to almost-complete words on the board
- Make players *feel hunted*

**The Bully personality now achieves this.** Testing confirmed: "it felt good!"

### Current Priority
**Phase 5: Online Multiplayer** — 1v1 real-time with room codes (see HANDOFF.md for full plan)

---

## Architecture
**Core Principle:** Game logic (Core/) is pure C# with NO Unity dependencies. Unity layer handles rendering, input, and UI only.

## File Reference

### Core/ - Pure C# Game Logic (no Unity dependencies)

| File | What it does |
|------|-------------|
| **Board.cs** | HexCoord struct, hex grid definition, neighbor calculation, leyline traversal, distance formulas |
| **GameState.cs** | Tile/Glyphling/GameState classes, all game data (hands, scores, tiles on board), game phase tracking |
| **GameRules.cs** | Static validation (valid moves, valid casts), state mutation (execute moves), draft placement rules |
| **WordScorer.cs** | Dictionary loading (63K words), word detection along leylines, scoring calculation, ownership bonuses |
| **TangleChecker.cs** | Detects when glyphlings are trapped (no valid moves), awards +10 to opponent |

### Core/ - AI System (Goal-Selection Model)

| File | What it does |
|------|-------------|
| **AIGoal.cs** | 7 goals enum, AIMove class, GoalSelector with priority cascade, TraitRange (0-100 scale) |
| **AIPersonality.cs** | 7 traits + meta-traits + subtraits, 7 personality presets (Bully, Scholar, Builder, Vulture, Survivor, Strategist, Balanced) |
| **AIGoalEvaluators.cs** | Goal-specific move evaluation functions (TrapEval, ScoreEval, DenyEval, etc.) |
| **AIBrain.cs** | Main AI: selects goal via trait roll, evaluates moves ONLY for active goal |
| **AIPerception.cs** | Fuzzy perception: estimated scores, hand quality, pressure detection, momentum |
| **AIConstants.cs** | Centralized tuning values for AI behavior (weights, thresholds, bonuses) |
| **TrapDetector.cs** | Analyzes opponent movement restrictions |
| **ContestDetector.cs** | Finds denial opportunities (blocking opponent's leylines) |
| **SetupDetector.cs** | Evaluates future word potential (gaps, pillars, intersections) |

### Core/Future/ - Archived (Old AI System)

| File | What it does |
|------|-------------|
| **Personality_OLD.cs** | OLD: 13 traits (0-10 scale), weighted scoring model - ARCHIVED |
| **AIMoveEvaluator_OLD.cs** | OLD: Weighted sum of all factors - ARCHIVED |

### Core/Stats/ - Game Statistics (pure C#)

| File | What it does |
|------|-------------|
| **StatsDataStructure.cs** | Core data types: PlayerInfo, WordScored, TangleEvent, MoveRecord, GameResult |
| **GameHistory.cs** | Complete game record: players, moves, initial hands, timestamps |
| **PlayerGameStats.cs** | Single game stats: words formed, scores, tangles, blocking moves |
| **GameStatsCalculator.cs** | Computes PlayerGameStats from GameHistory after game ends |
| **LifetimeStats.cs** | Cumulative player stats across all games: win rates, averages, records |
| **LifetimeStatsUpdater.cs** | Updates LifetimeStats after each completed game |
| **RadarChartCalculator.cs** | Computes 6-axis radar chart values from lifetime stats |
| **LeylineDetector.cs** | Detects if cast positions block opponent leylines (for blocking stats) |

### Unity/ - Game Control & Rendering

| File | What it does |
|------|-------------|
| **GameManager.cs** | Central coordinator: turn state machine, player turns, events, input mode switching. **The hub everything connects to.** |
| **BoardRenderer.cs** | Creates hex GameObjects, renders tiles/glyphlings, manages highlights, ghost previews, trapped pulse effect |
| **HexCoordConverter.cs** | Converts between HexCoord (grid) and Vector3 (world position) |
| **HandController.cs** | Renders player's letter tiles in hand, cycle mode for discarding tiles |
| **ScoreDisplay.cs** | Shows player scores, turn indicator, tangle markers |
| **WordHighlighter.cs** | Highlights valid words on board when previewing moves |

### Unity/ - Input Handling

| File | What it does |
|------|-------------|
| **HexClickHandler.cs** | Tap-mode input: clicking hexes to select glyphling, destination, cast position |
| **HexDragHandler.cs** | Drag-mode input: dragging glyphlings to move them |
| **HandTileDragHandler.cs** | Drag-mode input: dragging letter tiles from hand to cast position |
| **TouchInputController.cs** | Multi-touch handling: pinch zoom, two-finger pan for board navigation |
| **InputStateManager.cs** | Tracks global input state: what's being dragged, prevents conflicts |
| **InputUtility.cs** | Helper: converts screen coordinates to world positions on board plane |

### Unity/ - AI Integration

| File | What it does |
|------|-------------|
| **AIManager.cs** | Manages AI controllers for both players, supports human vs AI / AI vs AI / human vs human |
| **AIController.cs** | Executes one AI player's turn with coroutines for smooth animation, configurable think time |

### Unity/ - UI & Menus

| File | What it does |
|------|-------------|
| **GameUIController.cs** | In-game UI: confirm/cancel buttons, menu button, positioned relative to screen edges |
| **MenuController.cs** | Pause menu: settings, AI options, abandon game |
| **MainMenuScreen.cs** | Title screen: new game, resume, player count selection |
| **EndGameScreen.cs** | Victory/defeat screen with stats summary |
| **SettingsManager.cs** | Persists user preferences (drag offset, AI settings) via PlayerPrefs |
| **GameSettings.cs** | Static access to runtime settings (drag offset for touch input) |
| **UIScaler.cs** | Responsive scaling for portrait/landscape, different aspect ratios |

### Unity/ - Camera & Animation

| File | What it does |
|------|-------------|
| **CameraController.cs** | Board camera zoom/pan, portrait vs landscape framing, smooth transitions |
| **TweenManager.cs** | Simple position animation system with smoothstep easing |

### Unity/Stats/ - Stats Persistence

| File | What it does |
|------|-------------|
| **GameHistoryManager.cs** | Unity bridge for stats: tracks moves during play, triggers calculation on game end |
| **StatsPersistence.cs** | Saves/loads stats to JSON files, supports game save/resume for app backgrounding |

### Unity/Network/ - Online Multiplayer

| File | What it does |
|------|-------------|
| **NetworkServices.cs** | Unity Gaming Services init, anonymous authentication, connection state tracking |
| **GlyphtenderLobby.cs** | Room code matchmaking, lobby creation/joining, game settings in lobby data |
| **GlyphtenderRelay.cs** | NAT traversal via Unity Relay, allocate/join relay servers |
| **NetworkMessages.cs** | INetworkSerializable structs for moves, casts, drafts, game start, forfeit, rematch |
| **NetworkGameBridge.cs** | RPC wrapper bridging network and game logic, host-authoritative validation |
| **NetworkBootstrap.cs** | Auto-creates network singletons on scene load |

### Unity/ - Online Lobby

| File | What it does |
|------|-------------|
| **OnlineLobbyScreen.cs** | 3D UI for online matchmaking: Create/Join room, room code input, connection flow |

### Future/ - Not Yet Integrated

| File | What it does |
|------|-------------|
| **Core/Future/AIWordDetector.cs** | Advanced AI: finds "almost-words" (one letter from completion), threat detection |
| **Unity/Future/DraftManager.cs** | Template for extracting draft logic from GameManager |

---

## Coordinate System
- **11 columns** (0-10), corresponding to C1-C11 in game notation
- **Rows** are 0-indexed from each column's start position
- Column heights: `{ 5, 8, 9, 10, 9, 10, 9, 10, 9, 8, 5 }` = 92 hexes
- Start rows: `{ 3, 1, 1, 0, 1, 0, 1, 0, 1, 1, 3 }` (centered vertically)

### Converting Game Notation to Code
- C4-3 → HexCoord(3, 2)  // column index = notation - 1, row = notation - 1
- C8-8 → HexCoord(7, 7)

---

## Current Status
- ✅ Core game logic ported to C#
- ✅ Board renders correctly with 92 hexes
- ✅ Glyphlings spawn at correct positions
- ✅ Dictionary loaded (63,612 words)
- ✅ Draft phase implemented (snake draft for 2-4 players)
- ✅ Stats tracking system implemented
- ✅ All code files documented with comprehensive headers
- ✅ **PHASE 4 COMPLETE: AI Goal-Selection Model**
  - AIGoal.cs: 7 goals enum, GoalSelector with priority cascade
  - AIPersonality.cs: 7 traits (0-100), meta-traits, subtraits, 7 presets
  - AIGoalEvaluators.cs: Goal-specific move evaluation
  - Bully personality tested — pressures opponents as intended!
- ⏳ **PHASE 5 IN PROGRESS: Online Multiplayer**
  - ✅ **5.1 Foundation:** NetworkServices, GlyphtenderLobby, GlyphtenderRelay
  - ✅ **5.2 State Sync:** NetworkMessages, NetworkGameBridge, Online1v1 PlayMode
  - ✅ **5.3 Lobby UI:** OnlineLobbyScreen, NetworkBootstrap
  - ⏳ **5.4 Game State Sync:** Connect NetworkGameBridge to GameManager (next)

## Known Issues
1. **Hex directions may be incorrect** - The leyline movement paths don't work correctly after fixing the board layout. Need to verify/fix `HexCoord.Directions` array.

---

## Working with Muzzy

**Communication preferences:**
- **Don't pander** — Tell him when logic is flawed
- **Break instructions into steps** — Avoid overwhelming with too much at once
- **Ask clarifying questions** — Avoid assumption errors
- **He's not a coder** — Strong logic, limited technical vocabulary; explain without jargon
- **He can spot logic mistakes** — Use him as a design sanity-check

**What NOT to do:**
- Don't treat word scoring as the primary AI goal
- Don't add features before AI feels right
- Don't use Canvas UI (3D UI only)
- Don't assume fixed starting positions (snake draft is the system)

---

## Important Implementation Details

### Distance Calculation
Always use `HexCoord.DistanceTo()` for hex distance - it uses the correct cube-coordinate formula.

### Key Classes by Responsibility
| Class | Responsibility |
|-------|----------------|
| `GameState` | All game data (tiles, glyphlings, hands, scores) |
| `GameRules` | Static validation and state mutation |
| `GameManager` | Unity coordinator, turn state machine, events |
| `AIBrain` | AI decision making, uses Personality + Perception |
| `BoardRenderer` | Visual rendering of board, tiles, glyphlings |

### GameManager Events (subscribe to these for updates)
- `OnGameStateChanged` - Any state change
- `OnSelectionChanged` - Player selection changed
- `OnTurnEnded` - Turn completed
- `OnGameEnded` - Game over
- `OnDraftComplete` - Draft phase finished

---

## Recent Decisions
<!-- Add dated entries here when significant decisions are made -->
- **2026-01-04**: **PHASE 5.3 COMPLETE: Online Lobby UI**
  - OnlineLobbyScreen.cs: 3D UI for Create/Join room flow
  - NetworkBootstrap.cs: Auto-creates network singletons
  - Connected MainMenuScreen to lobby screen
  - Next: Phase 5.4 Game State Sync
- **2026-01-04**: **PHASE 5.2 COMPLETE: State Sync Infrastructure**
  - NetworkMessages.cs: All game actions as INetworkSerializable structs
  - NetworkGameBridge.cs: Host-authoritative RPC pattern
  - Online1v1 added to PlayMode enum, cycles after AI vs AI
- **2026-01-04**: **PHASE 5.1 COMPLETE: Network Foundation**
  - NetworkServices.cs: Unity Services init + anonymous auth
  - GlyphtenderLobby.cs: Room code matchmaking
  - GlyphtenderRelay.cs: NAT traversal
- **2026-01-04**: **PHASE 5 STARTED: Online Multiplayer**
  - Real-time 1v1 with room codes (not async turn-based)
  - Unity Gaming Services for MVP (free tier: 50 CCU, 10K DAU)
  - Architected with abstraction layer for future provider swap (Steam, Epic, etc.)
  - No Stats button yet (menu overhaul planned after multiplayer works)
  - AI takeover on disconnect/forfeit
- **2026-01-04**: **PHASE 4 AI REWORK COMPLETE** - Goal-selection model implemented and tested!
  - Created AIGoal.cs (7 goals, GoalSelector with priority cascade, TraitRange 0-100)
  - Created AIPersonality.cs (7 traits, meta-traits, subtraits, 7 presets)
  - Created AIGoalEvaluators.cs (goal-specific evaluation - only active goal scores moves)
  - Updated AIBrain.cs to select goal first, then evaluate moves for that goal only
  - Added Zipf threshold filtering to WordScorer for vocabulary access per personality
  - Archived old files to Core/Future/: Personality_OLD.cs, AIMoveEvaluator_OLD.cs
  - Bully personality tested and feels threatening!
- **2026-01-03**: Comprehensive documentation added to all 48 code files (file headers with context anchoring)
- **2026-01-03**: Consolidated duplicate HexDistance code into HexCoord.DistanceTo()
- **2026-01-03**: Moved unused AIWordDetector to Future/ folder (not deleted, may integrate later)
- **2026-01-03**: PlayMode enum moved from Unity layer to Core layer

---

## Key Files
- `HANDOFF.md` - Full project handoff document with vision, roadmap, and backlog
- `Documents/ARCHITECTURE.md` - Full architecture documentation
- `Documents/transcripts/` - Complete conversation history with design decisions

## Unity Setup
- Unity 2022.3 LTS (2022.3.62f1)
- 3D Built-in Render Pipeline
- Camera: position (7.5, 20, 8.5), rotation (90, 180, 0)

## Repository
https://github.com/TheBlueMuzzy/Glyphtender/
