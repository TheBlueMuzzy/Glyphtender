# The Glyphtender's Trial — Project Handoff Document

**Project Owner:** Muzzy  
**Document Purpose:** Comprehensive reference for maintaining project vision and continuity across development sessions  
**Last Updated:** January 2026

---

## Table of Contents

1. [Project Vision & Core Philosophy](#1-project-vision--core-philosophy)
2. [Game Rules & Mechanics](#2-game-rules--mechanics)
3. [Technical Architecture](#3-technical-architecture)
4. [UI/UX Philosophy](#4-uiux-philosophy)
5. [AI System Design](#5-ai-system-design)
6. [Current State & Completed Work](#6-current-state--completed-work)
7. [Roadmap & Future Goals](#7-roadmap--future-goals)
8. [Key Learnings & Principles](#8-key-learnings--principles)
9. [Development Practices & Workflow](#9-development-practices--workflow)
10. [Unimplemented Features Backlog](#10-unimplemented-features-backlog)

---

## 1. Project Vision & Core Philosophy

### 1.1 What This Game Is

**The Glyphtender's Trial** is a strategic mobile word game that combines hex-grid area control with spelling mechanics. It is NOT Scrabble with hexagons. The fundamental identity is:

> **"This is an area control game with a spelling element, not a spelling game with area control."**

This distinction is critical. Every design decision — especially AI behavior — must reinforce territorial pressure and spatial strategy as the primary gameplay layer, with word-forming as the tool players use to execute that strategy.

### 1.2 The Experience Muzzy Wants

- **Cozy but strategic** — Animations should feel "bubbly and satisfying," with deliberate pacing that gives players time to see and appreciate what's happening
- **Board game aesthetic** — The game should feel like playing a beautiful physical board game, not a mobile puzzle app
- **Threatening AI** — AI opponents should make players feel hunted, pressured, and worried about their Glyphlings' safety — not just outscored
- **Readable at a glance** — 3D UI elements parented to camera create immersion while maintaining clarity
- **Mobile-first** — All interactions designed for touch, with tap and drag both supported

### 1.3 Target Platforms (Priority Order)

1. **Mobile (Android/iOS)** — Primary target
2. **PC (Steam/Itch)** — Stretch goal, only if AI opponents are good enough
3. **Online multiplayer** — Future aspiration, architecture prepared for it

### 1.4 MoSCoW Prioritization

**Must Have (MVP):**
- Play full game vs AI on mobile
- Multiple AI personalities that feel distinct
- Polished enough to show friends
- Basic menu/UI

**Should Have (Post-MVP):**
- PC build
- Visual polish (VFX, 3D models)
- Audio system

**Could Have (Future):**
- Online multiplayer (simple matchmaking)
- Leaderboards
- Account system / stat tracking
- Advanced visuals (animated Glyphlings, growing plant letters)

**Won't Have (Out of Scope):**
- Local multiplayer (same device)
- Cross-platform accounts
- Ranked competitive modes
- Level editor

---

## 2. Game Rules & Mechanics

### 2.1 Core Components

- **Board:** Flat-top hexagonal grid (varies by size — see Board Sizes section)
- **Players:** 2-4 players, each controlling 2 Glyphlings
- **Glyphlings:** Player pieces that move and cast letter tiles
- **Runeblossoms:** Letter tiles drawn from a shared bag (120 total)
- **Hand Size:** 8 tiles per player

### 2.2 Turn Structure

Each turn follows this exact sequence:

1. **Move** one of your Glyphlings at least 1 hex along a leyline
   - Cannot pass through or land on tiles or other Glyphlings
   - Must move at least 1 hex (cannot stay in place)
   
2. **Cast** one Runeblossom from your hand along any leyline from the Glyphling's NEW position
   - Can pass over your own tiles, but NOT opponent's tiles or any Glyphlings
   - Must land on an empty hex
   - Tiles can be cast to any distance along the leyline, including adjacent
   
3. **Score** any valid words formed that include your newly-placed tile
   - Words must read left-to-right or top-to-bottom along leylines
   - Only score words containing the tile you just placed
   
4. **Draw/Cycle:**
   - If you scored: Draw 1 tile from the bag
   - If you didn't score: May discard any number of tiles, then refill to 8
   - **Digital refinement:** Discarded tiles are set aside, hand refills, THEN discards return to bag
   
5. **Check Tangle:** If any Glyphling has no valid moves (all 6 directions blocked), they are "tangled" — game ends when this occurs

### 2.3 Leylines (Movement/Casting Directions)

With flat-top hexes, there are 3 axes (6 directions):
- **Vertical:** Up / Down
- **Diagonal Ascending:** Down-Left / Up-Right
- **Diagonal Descending:** Up-Left / Down-Right

There is NO true horizontal leyline — this is intentional and correct.

### 2.4 Scoring System

**Word Scoring:**
- **Base Points:** Word length (number of letters)
- **Ownership Bonus:** +1 for each of YOUR tiles in the word
- Example: Spelling "HELP" (4 letters) with 2 of your tiles = 4 + 2 = 6 points

**Multi-Word Scoring:**
- If placing a tile creates multiple words on DIFFERENT leylines, score each separately
- Shared letters count toward both words' length AND ownership

**Same-Leyline Rule:**
- If a leyline contains multiple valid words (e.g., "HEAL" inside "HEALER"), only score the LONGEST valid word

**Tangle Scoring (End-Game):**
- When a Glyphling becomes tangled: opponent scores 3 points per THEIR tile adjacent to your tangled Glyphling
- Strategic implication: If you're ahead on points, intentionally tangling your own Glyphling near YOUR tiles denies opponent those adjacency points

### 2.5 2-Letter Word Toggle

A menu setting allows enabling/disabling 2-letter words. When disabled, minimum word length is 3 letters.

### 2.6 Board Sizes

| Board | Columns | Hexes | Interior | Layout |
|-------|---------|-------|----------|--------|
| Large | 13 | 106 | 74 | [5,7,8,9,10,9,10,9,10,9,8,7,5] |
| Medium | 11 | 85 | 59 | [4,7,8,9,10,9,10,9,8,7,4] |
| Small | 9 | 61 | 37 | [5,6,7,8,9,8,7,6,5] |

### 2.7 Player Counts & Colors

| Players | Glyphlings | Colors |
|---------|------------|--------|
| 2 | 2 each (4 total) | Yellow, Blue |
| 3 | 2 each (6 total) | Yellow, Blue, Purple |
| 4 | 2 each (8 total) | Yellow, Blue, Purple, Pink |

**Turn Order:** P1 → P2 → P3 → P4 → P1... (clockwise rotation)

**4-Player Mode:** Free-for-all (teams were considered but cut as less fun)

### 2.8 Snake Draft Placement Phase

Instead of fixed starting positions, players choose where to place their Glyphlings in a draft phase before normal play begins.

**Draft Order (Snake Draft):**
- 2P: P1 → P2 → P2 → P1
- 3P: P1 → P2 → P3 → P3 → P2 → P1
- 4P: P1 → P2 → P3 → P4 → P4 → P3 → P2 → P1

**Placement Rules:**
- Cannot place on perimeter hexes (board edges)
- Cannot place adjacent to ANY other Glyphling (regardless of owner)
- Uses same preview-and-confirm interaction as tile casting
- Hand shows unplaced Glyphlings (in player's color) instead of letter tiles during draft

**Why Snake Draft:**
- Adds strategic depth to positioning
- Eliminates first-move positional advantage complaints
- Makes each game's opening unique
- The math works: hex grids are 3-colorable, so ~1/3 of interior hexes can hold non-adjacent pieces

### 2.9 Coordinate System

The project uses a column-row coordinate system:
- **Game notation:** C4-3 means Column 4, Row 3
- **Code representation:** `HexCoord(column, row)` where both are 0-indexed
- **Conversion:** C4-3 → HexCoord(3, 2) (subtract 1 from both)

### 2.10 Dictionary

- **Word count:** ~63,479 cleaned words
- **Source:** Standard word list with abbreviations removed
- **Minimum length:** 2 letters (configurable via toggle)

---

## 3. Technical Architecture

### 3.1 Core Principle: Separation of Concerns

The architecture maintains strict separation between game logic and Unity rendering:

```
Assets/Scripts/
├── Core/           # Pure C# game logic — NO Unity dependencies
│   ├── Board.cs
│   ├── GameState.cs
│   ├── GameRules.cs
│   ├── WordScorer.cs
│   ├── TangleChecker.cs
│   └── HexCoord.cs
├── AI/             # AI system — also pure C#
│   ├── AIBrain.cs
│   ├── AIPerception.cs
│   ├── Personality.cs
│   ├── AIMoveEvaluator.cs
│   └── ...
└── Unity/          # Unity-specific code
    ├── GameManager.cs
    ├── BoardRenderer.cs
    ├── HandController.cs
    ├── CameraController.cs
    └── ...
```

**Why This Matters:**
- Core logic can be unit tested without Unity
- Same Core code could run on a server for multiplayer
- AI simulations don't touch rendering
- Clean interfaces between layers

### 3.2 State Machine

GameManager uses a state machine with these states:

```csharp
public enum GameTurnState
{
    Idle,               // Waiting for player to select Glyphling
    GlyphlingSelected,  // Glyphling selected, showing valid moves
    MovePending,        // Move destination selected, awaiting confirmation
    ReadyToConfirm,     // Tile cast selected, awaiting confirmation
    CycleMode,          // Player in discard/cycle phase
    DraftPhase,         // Snake draft placement phase
    GameOver            // Game ended (tangle detected)
}
```

State transitions are guarded — invalid transitions are rejected, preventing corrupted game states.

### 3.3 Singleton Pattern

Key managers use singleton pattern for global access:

```csharp
public static GameManager Instance { get; private set; }
public static BoardRenderer Instance { get; private set; }
public static HandController Instance { get; private set; }
// etc.
```

**Note:** Claude Code recommended considering dependency injection for better testability. This is a valid future refactor but not urgent.

### 3.4 GameState Cloning

`GameState.Clone()` enables AI to simulate moves without mutating the real state. This is critical for:
- AI move evaluation
- Preview calculations
- Future multiplayer rollback

### 3.5 Event System

Components communicate via events rather than direct coupling:

```csharp
public event Action<GameState> OnGameStateChanged;
public event Action<Glyphling> OnSelectionChanged;
public event Action<GameTurnState> OnTurnStateChanged;
```

### 3.6 Settings Persistence

Settings are saved to JSON file for persistence across sessions:

```csharp
// SettingsManager handles:
// - Play mode (Local 2P, vs AI, AI vs AI)
// - Player count
// - Board size
// - AI personalities
// - 2-letter word toggle
// - Input mode (Tap vs Drag)
// - Drag offset
// - AI speed
```

### 3.7 Statistics System

**Architecture (designed but implementation may be partial):**

- **Per-Turn Logging:** Each move is logged with full context
- **Per-Game Metrics:** Calculated at game end (longest word, best play, etc.)
- **Lifetime Aggregation:** Accumulates across games
- **Radar Chart:** 6-axis visualization (Wordsmith vs Tanglesmith pillars)

**Radar Chart Axes:**

| Axis | Hemisphere | Formula |
|------|------------|---------|
| Multi-word | Wordsmith | Multi-word turns ÷ Total scoring turns |
| Value | Wordsmith | Points ÷ Tiles played |
| Investment | Wordsmith | Your tiles in words ÷ Total tiles in words |
| Trapper | Tanglesmith | Tangles caused ÷ Games played |
| Aggression | Tanglesmith | Blocking plays ÷ Total plays |
| Resilience | Tanglesmith | Wins ÷ Times your glyphlings tangled |

### 3.8 Camera System

- **Two-camera setup:** Main camera for board (with zoom/pan), UI camera for 3D UI elements (fixed)
- **Board camera tilt:** 45-60 degrees on X axis for more immersive 3D feel
- **Auto-framing:** Camera automatically calculates bounds from board hexes
- **Gesture support:** Pinch zoom, double-tap zoom toggle, single-finger pan

### 3.9 Layer Setup

```
Board Layer:     Main camera renders this
UI Layer:        UI camera renders this (3D UI elements)
```

This separation prevents zoom/pan from affecting UI elements.

---

## 4. UI/UX Philosophy

### 4.1 3D UI, Not Canvas UI

A critical design decision: **All UI is 3D objects parented to the camera, not Unity Canvas elements.**

**Rationale:**
- UI feels like part of the board game world
- Tiles can animate from hand to board in 3D space
- More immersive than flat overlay
- Avoids Canvas rendering quirks

**Implementation:**
- HandAnchor is child of UICamera
- Tiles in hand are 3D cubes matching board tiles
- Buttons are 3D objects with click handlers

### 4.2 Preview-and-Confirm Pattern

All significant actions use a two-step interaction:

1. **Preview:** Player selects destination, sees ghost/preview
2. **Confirm:** Player explicitly confirms the action

This is mandatory for:
- Moving Glyphlings
- Casting tiles
- Draft placement

**Why This Matters:**
- Touch-friendly (prevents accidental taps)
- Allows player to see consequences before committing
- Matches mobile UX best practices

### 4.3 Hand Interaction

- **Visibility:** Hand can show/hide (toast-up/toast-down)
- **Future:** Fan curve layout with overlap spacing control
- **Tile dragging:** Can reorder tiles in hand via drag
- **Visual:** 3D tiles rotated toward camera, match board tile aesthetic

### 4.4 Input Mode Options

Two input modes supported:
- **Tap:** Tap to select, tap to confirm
- **Drag:** Drag pieces directly, release to place

Both should work everywhere. User can set preference in settings.

### 4.5 Animation Philosophy

Muzzy wants animations that feel:
- **"Bubbly"** — Scale pops, overshoot, bounce
- **Arc movement** — Things should move in arcs, not straight lines
- **Deliberate pacing** — Delays between steps so players can follow what happened
- **Cozy** — Not flashy or hyper-active, but warm and satisfying

**Animation Types Discussed:**
- Easing varieties (bounce, elastic, overshoot)
- Arc movement with pinnacle control
- Scale pops on appearance
- Score number ticking up
- Animation chaining with delays

### 4.6 Responsive Scaling

`UIScaler` singleton provides centralized responsive calculations:
- Adapts to aspect ratio changes
- Handles portrait/landscape switching
- All UI elements subscribe to `OnLayoutChanged` event
- Margins defined in screen units relative to camera ortho size

---

## 5. AI System Design

### 5.1 The Core Problem with AI

**Current AI behavior:** AI treats the game like Scrabble — maximize word score per turn.

**Correct AI behavior:** AI should treat the game like Go or Chess that uses words — area control, pressure, denial, with scoring as a *tool* not the *goal*.

This is THE fundamental gameplay issue. Every AI personality inherits a base scoring system that overweights word points relative to positional pressure. This makes all AI feel like word-optimizers rather than territorial threats.

### 5.2 What "Threatening" Looks Like

From Muzzy's description, threatening AI should:
- Block opponent's movement paths
- Box opponents toward tangle situations
- Deny access to almost-complete words on the board
- Force opponents to deal with pressure instead of freely building
- Make players *feel hunted*

The player's feedback: "I have sat for many turns in a vulnerable place, but they just kept scoring instead of pressuring me by trying to tangle me."

### 5.3 Personality System Architecture

AI personalities are defined by range-based traits (not fixed values):

```csharp
public struct PersonalityTraits
{
    public FloatRange Aggression;      // Low = defensive, High = hunts opponent
    public FloatRange Greed;           // Low = safe plays, High = big risky plays
    public FloatRange Protectiveness;  // Low = sacrifices pieces, High = guards carefully
    public FloatRange Patience;        // Low = score now, High = build for payoffs
    public FloatRange Spite;           // Low = ignores opponent, High = ruins setups
    public FloatRange Territorialism;  // Low = roams freely, High = creates/defends zones
}
```

**Range-based traits** create more natural variation — same personality makes different choices in similar situations.

### 5.4 Dynamic Modifiers

Traits are modified by game state:

| Modifier | Effect |
|----------|--------|
| Perceived Score Lead | Behind → more desperate, Ahead → more aggressive |
| Glyphling Pressure | High tangle threat → more defensive |
| Hand Quality | Bad hand → dump junk aggressively |
| Board Control | Losing space → territorial priority increases |
| Momentum | Recent scoring streak affects confidence |

### 5.5 Fuzzy Perception System

AI doesn't have perfect information. Implements "fuzzy knowledge":

```csharp
class ScorePerception
{
    float MyScoreEstimate;
    float OpponentScoreEstimate;
    float Confidence;  // Decays over time, updates on observed scores
}
```

This makes AI opponents feel more human — they can be wrong about who's winning.

### 5.6 Zone Detection

"Closed zones" are areas only one player can access:
- Bounded by tiles, Glyphlings, and board edges
- Opponent Glyphlings cannot path into the zone
- Value is strategic — more freedom to maneuver without interference

Zone detection is implemented but weight/priority may need tuning.

### 5.7 Known AI Issues to Address

1. **Builder personality doesn't actually build** — Should extend words across multiple turns (IN→KIN→SKIN), doesn't yet
2. **All AI favor density** — Base scoring overweights word points, makes games feel like word-optimizers
3. **Intersection plays too common** — Should be a personality trait (Strategist), not default behavior
4. **Missing goal-selection model** — Current system is weighted scoring; Muzzy described a "priority cascade with variance" model that might feel more human

### 5.8 Goal-Selection Model (Proposed Alternative)

Muzzy described an alternative to weighted scoring:

1. Personality defines *goal priority ranges* (not scoring weights)
2. Board pressure shifts those ranges
3. Perceived score differential shifts them again
4. Random roll within final range picks which *goal* drives the decision
5. If top goal can't be satisfied, fall to next goal

**Result:** Even the same personality in the same situation makes different choices sometimes — like humans.

This is NOT currently implemented but represents the design intent.

### 5.9 AI Personalities (Current)

| Personality | Intended Behavior |
|-------------|-------------------|
| Balanced | Moderate all traits |
| Builder | Extend words across turns, build chains |
| Bully | Aggressive, pressures opponent |
| Opportunist | Steals opponent setups, completion hunting |
| Strategist | Multi-word plays, intersection efficiency |
| (Others TBD) | Various combinations |

---

## 6. Current State & Completed Work

### 6.1 Completed Phases

**Phase 1: Foundation ✅**
- Code audit completed
- Stats system architecture designed

**Phase 2: Modes Update ✅**
- 2-letter word toggle with persistence
- Board size variants (Small/Medium/Large)
- Player count modes (2/3/4 players)
- Settings persistence (JSON)
- Snake draft placement phase

**Phase 3: UX & Onboarding (Partial)**
- Stats implementation ✅
- Menu system overhaul ✅
- Progressive disclosure tutorial — NOT DONE (depends on AI feeling right)

### 6.2 Working Systems

- Complete turn loop (move → cast → score → draw/cycle)
- All three board sizes functional
- 2-4 player support with turn rotation
- Snake draft placement with confirm/cancel
- Touch input (tap and drag modes)
- Pinch zoom, pan, double-tap zoom
- 3D UI (hand, buttons, scores)
- AI opponents (8 personalities, though behavioral improvements needed)
- Statistics tracking with radar chart
- Settings persistence
- Android builds working (IL2CPP + ARM64)

### 6.3 Known Issues / Technical Debt

- BoardRenderer is 900+ lines (god class, should be split)
- Static state in drag handlers (risk for multiplayer)
- Some `FindObjectOfType<>()` calls despite singletons available
- Winner text positioning/persistence bugs (may be fixed)

---

## 7. Roadmap & Future Goals

### 7.1 Current Phase Priority

**Phase 4: AI Behavioral Rework** — THIS IS THE PRIORITY

- Diagnose why all AI favor density/words over pressure
- Implement goal-selection model (or hybrid with current)
- Make "area control first, spelling second" the default
- Builder rework (actually builds across turns)
- Personality differentiation (feel distinct from each other)

### 7.2 Remaining Phases

**Phase 5: Polish**
- Audio system (SFX, music, animation callbacks)
- Animation polish (easing varieties, arcs, bubbly feel)
- Visual polish (vine letters, 3D figurines, VFX)

**Phase 6: Future**
- Online multiplayer
- Account system
- Leaderboards
- Platform builds (iOS, Steam, Itch)

### 7.3 Tutorial Dependency

Progressive disclosure tutorial should NOT be built until AI plays correctly. Teaching rules when AI doesn't embody those rules creates confusion.

---

## 8. Key Learnings & Principles

### 8.1 Design Principles

1. **Area control first, spelling second** — This is the game's identity
2. **Preview-and-confirm everything** — Essential for mobile touch UX
3. **3D UI over Canvas** — More immersive, more consistent with board game feel
4. **Range-based traits over fixed values** — Creates more human-like AI variation
5. **Fuzzy perception** — AI shouldn't have perfect information
6. **Clean Core/Unity separation** — Enables testing, portability, multiplayer-readiness

### 8.2 Technical Principles

1. **Singleton pattern for managers** — Use consistently (don't mix with FindObjectOfType)
2. **Event-driven updates** — Subscribe to state changes, don't poll
3. **Guard state transitions** — Invalid transitions should fail, not corrupt state
4. **Clone for simulation** — Never mutate real GameState during AI evaluation
5. **JSON for persistence** — Simple, readable, debuggable

### 8.3 Communication Principles (Working with Muzzy)

From Muzzy's preferences:
- **Don't pander** — Tell him when logic is flawed
- **Break instructions into steps** — Avoid overwhelming with too much at once
- **Ask clarifying questions** — Avoid assumption errors
- **Check work before submitting** — Self-review code
- **He's not a coder** — Strong logic, limited technical vocabulary; explain without jargon
- **He can spot logic mistakes** — Use him as a design sanity-check
- **Complete file replacements over patches** — Easier for non-technical implementation

### 8.4 What NOT To Do

- Don't treat word scoring as the primary goal
- Don't add features before AI feels right
- Don't use Canvas UI
- Don't assume fixed starting positions (snake draft is the system)
- Don't implement multi-turn lookahead without discussing complexity/value tradeoff
- Don't skip reading relevant SKILL.md files before implementation

---

## 9. Development Practices & Workflow

### 9.1 Git Commit Format

```
Commit this:
1. GitHub Desktop
2. Summary: `Brief description of change`
3. Description: (optional longer details)
4. Commit to main
5. Push origin
```

### 9.2 Chat Organization

Muzzy uses multiple Claude chats within a Project, organized by topic:
- PROJECT MANAGEMENT — Master tracking
- Topic-specific chats (REFACTOR, AI IMPLEMENTATION, etc.)

When starting a new chat, reference previous chats for context.

### 9.3 Code Quality Standards

- **Industry-standard** — Code should pass professional review
- **Clean separation** — Core vs Unity
- **Self-documenting** — Clear names, XML doc comments
- **No magic numbers** — Extract to constants or ScriptableObjects
- **Consistent patterns** — Use established patterns (singleton, events, etc.)

### 9.4 File Locations

```
/mnt/user-data/uploads/     — User's uploaded files (read-only)
/mnt/user-data/outputs/     — Final deliverables (user can download)
/home/claude/               — Working directory (temporary)
```

When creating files for Muzzy, always copy to `/mnt/user-data/outputs/`.

---

## 10. Unimplemented Features Backlog

### 10.1 Visual/Polish

| # | Feature | Notes |
|---|---------|-------|
| 1 | Vine letter graphics | Letters made of vines, graphic design feel |
| 2 | 3D Glyphling figurines | Replace placeholders with proper models |
| 3 | Growing plant letters animation | Future visual upgrade |
| 4 | VFX / Particles | General polish |
| 5 | Trapped Glyphling vine animation | Currently just pulsing color |
| 6 | Multiple board themes | Different visual sets |
| 7 | Animated 3D Glyphlings | Movement animations |

### 10.2 Animation System

| # | Feature | Notes |
|---|---------|-------|
| 8 | Easing varieties | Bounce, elastic, overshoot |
| 9 | Arc movement | With pinnacle control |
| 10 | Scale pops | On tile appearance |
| 11 | Rotation animations | Spin into place |
| 12 | Score number ticking up | Animated counter |
| 13 | Animation chaining with delays | Paced sequences |
| 14 | "Bubbly" feel | Overall animation personality |

### 10.3 AI System

| # | Feature | Notes |
|---|---------|-------|
| 15 | Multi-turn lookahead | Under consideration, complex |
| 16 | Incremental word building | IN→KIN→SKIN across turns |
| 17 | Goal-selection model | Alternative to weighted scoring |
| 18 | Closed zone strategy weight | Tune zone detection impact |

### 10.4 Audio

| # | Feature | Notes |
|---|---------|-------|
| 19 | Sound effects system | Not started |
| 20 | Music system | Not started |
| 21 | Animation callbacks for audio | Sync sounds to animations |

### 10.5 Platforms/Distribution

| # | Feature | Notes |
|---|---------|-------|
| 22 | iOS build | Target but not tested |
| 23 | PC/Steam build | Stretch goal |
| 24 | Itch.io build | Alongside Steam |

### 10.6 Future Systems

| # | Feature | Notes |
|---|---------|-------|
| 25 | Online multiplayer | Architecture designed, not built |
| 26 | Account system | For stat persistence |
| 27 | Leaderboards | Competitive rankings |

### 10.7 Cleanup

| # | Item | Notes |
|---|------|-------|
| 28 | Remove Hand Dock code | Dead code in menu |
| 29 | Split BoardRenderer | God class, 900+ lines |

---

## Appendix A: Quick Reference — Game Flow

```
[Draft Phase]
    P1 places Glyphling → Confirm
    P2 places Glyphling → Confirm
    ...snake draft continues...
    All placed → Begin normal play

[Normal Turn]
    Select Glyphling
        ↓
    Select Move Destination (preview)
        ↓
    Confirm Move
        ↓
    Select Cast Position (preview + word detection)
        ↓
    Select Letter from Hand
        ↓
    Confirm Cast
        ↓
    Score words (if any formed)
        ↓
    Draw 1 tile (if scored) OR enter Cycle Mode (if not)
        ↓
    Check Tangle → If tangled, Game Over
        ↓
    Next player's turn
```

---

## Appendix B: Quick Reference — File Structure

```
Assets/Scripts/Core/
    Board.cs            — Hex grid, coordinate system, board configs
    GameState.cs        — Game state data (tiles, glyphlings, hands, scores)
    GameRules.cs        — Move validation, turn execution, starting positions
    WordScorer.cs       — Dictionary, word detection, scoring
    TangleChecker.cs    — Trapped glyphling detection
    HexCoord.cs         — Hex coordinate struct and math

Assets/Scripts/AI/
    AIBrain.cs          — Core decision-making
    AIPerception.cs     — Fuzzy knowledge system
    Personality.cs      — Trait definitions
    AIMoveEvaluator.cs  — Move scoring
    (+ supporting files)

Assets/Scripts/Unity/
    GameManager.cs      — Central controller, state machine
    BoardRenderer.cs    — Hex/tile/glyphling rendering
    HandController.cs   — Hand UI, tile interaction
    CameraController.cs — Camera zoom/pan/framing
    TouchInputController.cs — Gesture handling
    GameUIController.cs — Buttons, prompts
    ScoreDisplay.cs     — Score UI
    MenuController.cs   — Main menu
    SettingsManager.cs  — Persistence
    UIScaler.cs         — Responsive scaling
    TweenManager.cs     — Animation system
    WordHighlighter.cs  — Word outline visualization
```

---

## Appendix C: Board Coordinate Visualizations

### Large Board (13 columns, 106 hexes)

```
     Col: 0  1  2  3  4  5  6  7  8  9  10 11 12
          5  7  8  9  10 9  10 9  10 9  8  7  5
```

### Medium Board (11 columns, 85 hexes)

```
     Col: 0  1  2  3  4  5  6  7  8  9  10
          4  7  8  9  10 9  10 9  8  7  4
```

### Small Board (9 columns, 61 hexes)

```
     Col: 0  1  2  3  4  5  6  7  8
          5  6  7  8  9  8  7  6  5
```

---

*End of Handoff Document*
