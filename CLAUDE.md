# Glyphtender - Claude Code Guide

## Quick Commands
| Command | Action |
|---------|--------|
| **`<commit>`** | Stage all, commit with message, update both .md files, then push. this includes claude.md and handoff.md in C:\Users\Muzzy\Documents\UnityProjects\Glyphtender |
| **`<status>`** | Show the project focus/progress|
| **`<claude>`** | Read CLAUDE.md from C:\Users\Muzzy\Documents\UnityProjects\Glyphtender |
| **`<handoff>`** | Read HANDOFF.md for deep context from C:\Users\Muzzy\Documents\UnityProjects\Glyphtender |
| **`<updateclaude>`** | Explicit: add following info to CLAUDE.md |
| **`<updatehandoff>`** | Explicit: add following info to HANDOFF.md |
| **`<refactorcheck>`** | analyze the project for refactor opportunities in |

---

## Capturing User Context

**Proactively capture important information Muzzy shares:**
- If he mentions design decisions, preferences, or insights worth preserving → add to appropriate .md file
- Use judgment: not everything needs documenting, but vision/decisions/learnings should be captured
- `<claude>` and `<handoff>` are explicit commands, but you should recognize important info without them

---

## Session Workflow

### Starting a Session
1. Read this file (CLAUDE.md in C:\Users\Muzzy\Documents\UnityProjects\Glyphtender) for current state
2. Check git log for recent changes
3. If user says <handoff> → read HANDOFF.md for full project context in C:\Users\Muzzy\Documents\UnityProjects\Glyphtender

### During a Session
- Use TodoWrite to track multi-step tasks
- Commit frequently with descriptive messages
- Update "Current Work" section as progress is made

### Ending a Session / Commit Command
1. Stage all changes: `git add -A`
2. Commit with descriptive message
3. Update this file's "Current Work" and "Known Issues" sections
4. If significant progress: update "Session Log" below
5. Push to remote
6. **IMPORTANT:** If in a worktree, update the main repo copy here C:\Users\Muzzy\Documents\UnityProjects\Glyphtender first, then do the worktree versions

### File Sync (Worktrees)
Main repo: `C:\Users\Muzzy\Documents\UnityProjects\Glyphtender`
After editing .md files in a main repo C:\Users\Muzzy\Documents\UnityProjects\Glyphtender , copy to worktree and commit both.
- Muzzy may do manual editing on the main repo versions, so they are the source of truth!
---

## Current Work

**Phase 5.4: Online Draft & Play Phase Sync** (UNIFIED PREFAB LIFECYCLE COMPLETE)

Both glyphlings AND tiles now use same unified lifecycle: same 3D object from hand → board (no destroy/recreate).

### What's Working
- Auth → Lobby → Relay → Connection established
- Both players see board and can interact
- NetworkGameBridge spawns and syncs correctly
- Draft placements sync between players
- **Glyphling prefab system** - same object from hand → board (no destroy/recreate)
- **Tile prefab system** - now same lifecycle as glyphlings!
- Proper material application to prefabs
- Ghost lifecycle management for both tiles and glyphlings

### What Was Fixed This Session
1. **Unified Tile Lifecycle** - Same pattern as glyphlings
   - `BoardRenderer.ShowGhostTile(existingObject)` - accepts existing object from hand
   - `BoardRenderer.ConfirmGhostTile()` - registers ghost as permanent board tile
   - `HandController.UntrackTileObject()` - removes from hand tracking without destroy
   - `HandTileDragHandler.EndDrag()` - now passes object to BoardRenderer
   - Handlers are destroyed on confirm, object persists

2. **Runeblossom Animation Vision** - Documented in HANDOFF.md
   - Future: Seeds arc from hand, arrows draw, water splash animations
   - Architecture now supports this (object transfer, not recreation)

### What Needs Testing
- Tile drag → place → confirm flow (should use same object throughout)
- Cancel/return to hand (object should return correctly)
- Online play phase (move + cast actions)
- Turn indicator after draft in online mode

---

## Known Issues

1. **Hex directions may be incorrect** - Leyline movement paths may not work correctly. Need to verify `HexCoord.Directions` array.

2. **Online Play Phase** (Phase 5.4 - needs testing):
   - Glyphling color fix needs testing (was white, should be yellow/blue now)
   - Turn sync after draft needs testing (both showed "waiting", should be fixed now)

---

## Working with Muzzy

- **Don't pander** — Tell him when logic is flawed
- **Break into steps** — Avoid overwhelming with too much at once
- **Ask clarifying questions** — Avoid assumption errors
- **He's not a coder** — Strong logic, limited technical vocabulary
- **He spots logic mistakes** — Use him as design sanity-check

**Don't:**
- Treat word scoring as primary AI goal (area control first!)
- Use Canvas UI (3D UI only)
- Add features before current phase works

---

## Key Architecture Points

**Core/Unity Separation:** All game logic is pure C# in Core/. Unity layer only handles rendering/input.

**Online Mode Detection:**
```csharp
// Use GlyphtenderLobby.IsHost (not NetworkManager.IsHost - timing issues)
// NetworkedGameManager.IsOnlineGame checks PlayMode + active network session
// NetworkedGameManager.LocalPlayer = Yellow (host) or Blue (guest)
// NetworkedGameManager.IsLocalPlayerTurn guards input
```

**NetworkGameBridge:** Is a NetworkBehaviour, requires NetworkObject component, must be spawned by host after StartHost().

**Key Events:**
- `GameManager.OnGameStateChanged` - Any state change
- `GameManager.OnGameInitialized` - Game started
- `GameManager.OnDraftComplete` - Draft phase finished
- `GameManager.OnTurnEnded` - Turn completed

---

## Session Log

### 2026-01-04 (Phase 5.4 - Glyphling Prefab Lifecycle)
- Created glyphling prefab system (Quad-based with materials)
- Same object from hand → board (no destroy/recreate)
- Added `ShowGhostGlyphling(existingObject)` for drag mode
- Added `ConfirmGhostGlyphling()` to register ghost as permanent
- Added `HandController.UntrackGlyphlingObject()` to prevent double-destroy
- Fixed rotation: 90° for board, 180° for hand
- Added BoxCollider for prefab interaction

### 2026-01-04 (Phase 5.4 - Glyphling Color & Turn Sync Fix)
- Fixed glyphling prefab not getting material applied (was white on host)
- Fixed `Update()` trapped pulsing to use `GetPlayerMaterial()` for all 4 players
- Added `GameManager.NotifyNetworkDraftPlacement()` for network to fire events
- Now `OnNetworkDraftPlacementConfirmed` properly fires `OnDraftComplete` and `OnGameStateChanged`

### 2026-01-04 (Phase 5.4 - Play Phase Sync)
- Simplified ConfirmMove network condition (was requiring 7 conditions, now just IsOnlineGame)
- Added DontDestroyOnLoad to NetworkedGameManager
- Added debug logging for material assignment in BoardRenderer
- Fixed Update loop to use GetPlayerMaterial for all 4 players (was hardcoded Yellow/Blue)
- TurnIndicator now subscribes to OnOnlineModeInitialized event

### 2026-01-04 (Phase 5.4 - Draft Sync)
- Fixed NetworkGameBridge RPC error (added NetworkObject, host spawns it)
- Improved IsOnlineGame detection (checks lobby/relay state too)
- Added TurnIndicator.cs for "Your turn" / "Waiting for..." UI
- HandController hides glyphlings when not local player's turn
- GameManager routes draft placement through network in online mode
- NetworkedGameManager applies received draft placements

### 2026-01-04 (Phase 5.1-5.3)
- NetworkServices, GlyphtenderLobby, GlyphtenderRelay created
- NetworkMessages, NetworkGameBridge created
- OnlineLobbyScreen UI with room codes
- Pre-allocate relay before showing room code (race condition fix)

### 2026-01-04 (Phase 4 Complete)
- AI Goal-Selection Model implemented
- 7 goals, 7 traits (0-100), priority cascade
- Bully personality tested - feels threatening!

---

## Repository
https://github.com/TheBlueMuzzy/Glyphtender/

## For Deep Context
Read **HANDOFF.md** for:
- Full game rules and mechanics
- AI system design details
- Architecture documentation
- Complete roadmap and backlog
- Design principles and philosophy
