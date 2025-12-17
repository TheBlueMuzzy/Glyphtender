# The Glyphtender's Trial - Architecture Document

## Overview

This document describes how the Unity project is organized. Reference it when adding features or debugging issues.

---

## Core Principle: Separation of Game Logic and Unity

The game rules (board, moves, scoring, AI) are written in **pure C#** with no Unity dependencies. Unity is only used for:
- Rendering (showing the board)
- Input (detecting taps/clicks)
- UI (menus, buttons, text)
- Platform features (saving, audio, etc.)

**Why this matters:**
- Game logic can be tested without Unity
- Easier to port to other platforms later
- AI can run without rendering anything
- Multiplayer: same logic runs on server and client

---

## Project Structure

```
Assets/
├── Scripts/
│   ├── Core/                 # Pure C# game logic (no Unity)
│   │   ├── Board.cs          # Hex grid, coordinates, neighbors
│   │   ├── GameState.cs      # Tiles, Glyphlings, hands, bag
│   │   ├── GameRules.cs      # Move validation, turn flow
│   │   ├── WordScorer.cs     # Dictionary, word detection, scoring
│   │   └── TangleChecker.cs  # Tangle detection, endgame
│   │
│   ├── AI/                   # AI system (no Unity)
│   │   ├── Personality.cs    # Traits, presets
│   │   ├── Perception.cs     # Fuzzy score tracking, hand quality
│   │   ├── ThreatAssessor.cs # Escape routes, forcing moves
│   │   ├── ZoneDetector.cs   # Closed zone analysis
│   │   ├── TacticalSearch.cs # Critical position analysis
│   │   └── AIPlayer.cs       # Main AI decision maker
│   │
│   ├── Unity/                # Unity-specific code
│   │   ├── GameManager.cs    # Coordinates everything
│   │   ├── BoardRenderer.cs  # Draws the board
│   │   ├── InputHandler.cs   # Handles taps/clicks
│   │   ├── UIController.cs   # Menus, HUD, popups
│   │   └── AudioManager.cs   # Sound effects, music
│   │
│   └── Network/              # Future: multiplayer
│       └── (empty for now)
│
├── Prefabs/                  # Reusable game objects
│   ├── HexTile.prefab
│   ├── Glyphling.prefab
│   └── LetterToken.prefab
│
├── Scenes/
│   ├── MainMenu.unity
│   └── Game.unity
│
├── Resources/
│   └── words.txt             # Dictionary file
│
├── Art/                      # Your 3D models, textures
│   ├── Models/
│   ├── Materials/
│   └── Textures/
│
└── Audio/                    # Sound files
    ├── SFX/
    └── Music/
```

---

## Data Flow: How a Turn Happens

A turn is not one action - it's a multi-step process with preview and confirmation.

### Player Turn UX Flow

```
1. Player taps their Glyphling
        │
        ▼
2. Board highlights valid movement destinations
        │
        ▼
3. Player taps destination (or drags Glyphling there)
        │
        ▼
4. Glyphling moves (visually) - NOT committed yet
        │
        ▼
5. Board highlights valid cast destinations
        │
        ▼
6. Player taps cast destination
        │
        ▼
7. Player's hand is shown / selectable
        │
        ▼
8. Player taps letter from hand
        │
        ▼
9. Letter appears at cast position (preview)
        │
        ▼
10. Word detection runs - shows "WORD +5" preview (not scored yet)
        │
        ▼
11. Player can:
    ├── Tap different letter → swap, re-preview (back to step 8)
    ├── Tap "Reset" → undo everything (back to step 1)
    └── Tap "Confirm" → commit the move
        │
        ▼
12. ON CONFIRM: Move is locked in
        │
        ▼
13. Score is calculated and added
        │
        ▼
14. If scored: auto-draw 1 tile
    If not scored: discard flow (select tiles → redraw to 8)
        │
        ▼
15. Tangle check - is game over?
        │
        ▼
16. Pass turn to opponent (or AI)
```

### Key Architecture Implications

**PendingMove state:**
- GameManager holds a "pending" move that isn't committed
- BoardRenderer shows the pending state visually
- Core GameState is NOT modified until confirm

**Word Preview vs Word Scoring:**
- `WordScorer.PreviewWords()` - returns words that WOULD be formed (no state change)
- `WordScorer.ScoreWords()` - called only on confirm, modifies score

**Hidden Information:**
- Opponent (human or AI) never sees the pending move
- In multiplayer: pending state is local only, not sent to server until confirmed

**Input Modes:**
- Tap-tap: tap source, tap destination
- Drag-drop: drag from source to destination
- Both work interchangeably at each step
- InputHandler abstracts this - GameManager just receives "selected X"

### Data Flow Through Systems

```
┌─────────────────────────────────────────────────────────────┐
│                      PREVIEW PHASE                          │
│  (GameState unchanged, only visual/UI updates)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  InputHandler                                               │
│       │                                                     │
│       ▼                                                     │
│  GameManager.SetPendingGlyphling(coord)                     │
│       │                                                     │
│       ▼                                                     │
│  GameRules.GetValidMoves() ──► BoardRenderer.ShowHighlights │
│       │                                                     │
│       ▼                                                     │
│  GameManager.SetPendingDestination(coord)                   │
│       │                                                     │
│       ▼                                                     │
│  GameManager.SetPendingCast(coord, letter)                  │
│       │                                                     │
│       ▼                                                     │
│  WordScorer.PreviewWords() ──► UIController.ShowWordPreview │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                    [Confirm]
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      COMMIT PHASE                           │
│  (GameState modified, scores updated, turn advances)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GameManager.ConfirmMove()                                  │
│       │                                                     │
│       ▼                                                     │
│  GameRules.ExecuteMove(pendingMove, gameState)              │
│       │                                                     │
│       ▼                                                     │
│  WordScorer.ScoreWords() ──► GameState.AddScore()           │
│       │                                                     │
│       ▼                                                     │
│  TangleChecker.CheckGameEnd()                               │
│       │                                                     │
│       ▼                                                     │
│  GameState.DrawTile() or DiscardFlow                        │
│       │                                                     │
│       ▼                                                     │
│  GameManager.SwitchTurn()                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI Turn Flow

AI doesn't need preview - it commits immediately:

```
1. GameManager detects it's AI's turn
        │
        ▼
2. AIPlayer.ChooseMove() runs (may take a moment)
        │
        ▼
3. GameManager receives Move
        │
        ▼
4. Optional: Animate the move for player to see
        │
        ▼
5. GameRules.ExecuteMove() - commits immediately
        │
        ▼
6. Continue from step 13 above (scoring, draw, tangle check)
```

---

## Key Classes

### Core/Board.cs
- `HexCoord` - Column/row coordinate for a hex
- `Board` - The 92-hex grid
- Methods: `GetNeighbor()`, `GetLeyline()`, `IsValidHex()`

### Core/GameState.cs
- Holds current state: tiles, Glyphling positions, hands, bag, scores
- Methods: `PlaceTile()`, `MoveGlyphling()`, `DrawTile()`, `Copy()`
- No game rules here - just data
- Immutable during preview phase - only modified on commit

### Core/GameRules.cs
- `GetValidMoves()` - All legal moves for a player
- `GetValidDestinations()` - Where can this Glyphling move?
- `GetValidCastTargets()` - Where can this Glyphling cast from this position?
- `ValidateMove()` - Is this specific move legal?
- `ExecuteMove()` - Apply move to GameState, return result
- `CheckGameEnd()` - Is the game over?

### Core/WordScorer.cs
- `PreviewWords()` - What words WOULD be formed? (no state change)
- `ScoreWords()` - Calculate and apply score (called on commit)
- Loads dictionary from Resources/words.txt

### AI/AIPlayer.cs
- `ChooseMove()` - Returns the AI's chosen move
- Uses Personality, Perception, ThreatAssessor, etc.
- Three-stage evaluation: quick filter → deep analysis → tactical search

### Unity/GameManager.cs
- The "conductor" - connects everything
- Holds references to GameState, GameRules, AIPlayer, Renderers
- **Manages pending move state:**
  - `SetPendingGlyphling(coord)`
  - `SetPendingDestination(coord)`
  - `SetPendingCast(coord, letter)`
  - `ResetPending()` - Undo current turn
  - `ConfirmMove()` - Commit pending move to GameState
- Handles turn flow, game start/end

### Unity/BoardRenderer.cs
- Reads GameState AND pending state, positions 3D objects accordingly
- Shows highlights for valid moves
- Shows preview of pending tile placement
- Handles animations (tile placement, Glyphling movement)
- Does NOT modify GameState

### Unity/InputHandler.cs
- Converts screen position to hex coordinate
- Supports both tap-tap AND drag-drop (interchangeable)
- Tracks current input phase (select Glyphling → select destination → select cast → select letter)
- Sends selections to GameManager
- Does NOT know about game rules - just reports what was tapped/dragged

### Unity/UIController.cs
- Hand display (shows player's letters)
- Word preview ("WORD +5" before confirm)
- Score display
- Confirm / Reset buttons
- Menus, popups
- Discard flow UI

---

## State Machine: Game Flow

```
┌─────────────┐
│  MainMenu   │
└──────┬──────┘
       │ Start Game
       ▼
┌─────────────┐
│ GameSetup   │  (choose AI personality, difficulty)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PlayerTurn  │◄─────────────────┐
└──────┬──────┘                  │
       │ Move made               │
       ▼                         │
┌─────────────┐                  │
│ Processing  │  (scoring, etc.) │
└──────┬──────┘                  │
       │                         │
       ▼                         │
   Game over? ───No──► Switch ───┘
       │               turn
      Yes
       │
       ▼
┌─────────────┐
│  GameOver   │  (show results)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  MainMenu   │
└─────────────┘
```

---

## Future: Multiplayer Architecture

When we add online play, the structure changes slightly:

**Local Game (current):**
```
InputHandler → GameManager → GameState
```

**Online Game (future):**
```
InputHandler → NetworkManager → Server → GameState (server)
                                    │
                                    ▼
                              Broadcast to clients
                                    │
                                    ▼
                              GameState (local copy)
```

The Core/ classes stay identical. We add a NetworkManager that:
- Sends moves to server instead of executing locally
- Receives game state updates from server
- Keeps local GameState in sync

This is why Core/ has no Unity dependencies - the server can run the same code.

---

## MoSCoW Breakdown

### Must Have (MVP)
- Core/: Board, GameState, GameRules, WordScorer, TangleChecker
- AI/: Full AI system (all personalities working)
- Unity/: GameManager, BoardRenderer, InputHandler, basic UIController
- Scenes: MainMenu, Game
- One complete playable game loop

### Should Have (Post-MVP)
- Audio system
- Visual polish (animations, particles)
- Settings menu (volume, etc.)
- Multiple board themes

### Could Have (Future)
- Network/: Online multiplayer
- Account system
- Leaderboards
- Advanced AI personalities
- Animated 3D Glyphlings

### Won't Have (Out of Scope)
- Local multiplayer
- Cross-platform accounts
- Ranked competitive mode
- Level editor

---

## Porting from Python

The Python prototype maps to Unity like this:

| Python File | Unity Location |
|-------------|----------------|
| board.py | Core/Board.cs |
| game.py | Core/GameState.cs |
| engine.py | Core/GameRules.cs |
| words.py | Core/WordScorer.cs |
| perception.py | AI/Perception.cs |
| personality.py | AI/Personality.cs |
| threats.py | AI/ThreatAssessor.cs |
| zones.py | AI/ZoneDetector.cs |
| tactical.py | AI/TacticalSearch.cs |
| personality_ai.py | AI/AIPlayer.cs |
| display.py | (not needed - Unity handles rendering) |

---

## Next Steps

1. Create Unity project in Unity/ folder
2. Set up folder structure (Scripts/, Prefabs/, etc.)
3. Port Core/ classes first (pure C#, no Unity)
4. Port AI/ classes
5. Build Unity/ layer to connect them
6. Playtest and iterate

---

## Questions?

If something in this document doesn't make sense, ask before coding. Better to clarify now than refactor later.
