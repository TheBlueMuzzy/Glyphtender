# The Glyphtender's Trial - Project Context

## Overview
A strategic word game played on a 92-hex flat-top hexagonal grid. Two players (Yellow and Blue) each control 2 Glyphlings that move along leylines and cast letter tiles to form words.

## Architecture
**Core Principle:** Game logic (Core/, AI/) is pure C# with NO Unity dependencies. Unity layer handles rendering, input, and UI only.

```
Assets/Scripts/
├── Core/           # Pure C# game logic
│   ├── Board.cs        # Hex grid, coordinates, neighbors
│   ├── GameState.cs    # Tile, Glyphling, GameState classes
│   ├── GameRules.cs    # Move validation, turn execution
│   ├── WordScorer.cs   # Dictionary, word detection, scoring
│   └── TangleChecker.cs # Trapped glyphling detection
├── AI/             # AI system (not yet ported from Python)
└── Unity/          # Unity-specific code
    ├── GameManager.cs   # Central controller, turn state
    ├── BoardRenderer.cs # Hex rendering, click handling
    └── UIController.cs  # Hand display, scores, buttons
```

## Coordinate System
- **11 columns** (0-10), corresponding to C1-C11 in game notation
- **Rows** are 0-indexed from each column's start position
- Column heights: `{ 5, 8, 9, 10, 9, 10, 9, 10, 9, 8, 5 }` = 92 hexes
- Start rows: `{ 3, 1, 1, 0, 1, 0, 1, 0, 1, 1, 3 }` (centered vertically)

### Converting Game Notation to Code
- C4-3 → HexCoord(3, 2)  // column index = notation - 1, row = notation - 1
- C8-8 → HexCoord(7, 7)

## Starting Positions
```csharp
YellowStartPositions = { new HexCoord(3, 7), new HexCoord(7, 2) }  // C4-8, C8-3
BlueStartPositions = { new HexCoord(3, 2), new HexCoord(7, 7) }    // C4-3, C8-8
```

## Game Rules
- **Hand size:** 8 tiles per player
- **Movement:** Glyphlings move along straight leylines (6 directions), blocked by tiles and other glyphlings
- **Casting:** After moving, cast a letter to an adjacent empty hex
- **Scoring:** Words formed along leylines score letter point values
- **Tangle:** A trapped glyphling (no valid moves) gives opponent +10 points
- **Qu:** Treated as single tile worth 10 points

## Flat-Top Hex Directions
Six directions for movement/leylines (needs verification - may have bugs):
- East, Northeast, Northwest, West, Southwest, Southeast

## Current Status
- ✅ Core game logic ported to C#
- ✅ Board renders correctly with 92 hexes
- ✅ Glyphlings spawn at correct positions
- ✅ Dictionary loaded (63,612 words)
- ⚠️ Hex neighbor/direction logic may need fixing for new coordinate system
- ❌ AI system not yet ported from Python
- ❌ UI not yet connected

## Known Issues
1. **Hex directions may be incorrect** - The leyline movement paths don't work correctly after fixing the board layout. Need to verify/fix `HexCoord.Directions` array.

## Python Prototype Reference
Full Python prototype exists with:
- Complete AI personality system (10 traits, 8 presets)
- Fuzzy perception, threat assessment, zone detection
- Tactical search for forcing moves
- See transcripts in Documents/ for details

## Key Files
- `Documents/ARCHITECTURE.md` - Full architecture documentation
- `Documents/transcripts/` - Complete conversation history with design decisions

## Unity Setup
- Unity 2022.3 LTS (2022.3.62f1)
- 3D Built-in Render Pipeline
- Camera: position (7.5, 20, 8.5), rotation (90, 180, 0)

## Repository
https://github.com/TheBlueMuzzy/Glyphtender/
