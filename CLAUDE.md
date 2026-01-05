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

### Version Tracking (IMPORTANT)
**Unity sometimes doesn't recompile code.** To verify changes are active:
1. Before asking Muzzy to test, increment BUILD_VERSION in `MainMenuScreen.cs:129`
2. Tell Muzzy which version to look for (e.g., "Look for v744")
3. The version appears in red text at the top of the main menu
4. If version doesn't match, Unity needs manual refresh/recompile

### Ending a Session / Commit Command
1. Stage all changes: `git add -A`
2. Commit with descriptive message
3. Update this file's "Current Work" and "Known Issues" sections
4. If significant progress: update "Session Log" below
5. Push to remote
6. **IMPORTANT:** If in a worktree, update the main repo copy here C:\Users\Muzzy\Documents\UnityProjects\Glyphtender first, then do the worktree versions

### File Sync (Worktrees)
Main repo: `C:\Users\Muzzy\Documents\UnityProjects\Glyphtender`
Worktrees are at: `C:\Users\Muzzy\.claude-worktrees\Glyphtender\<worktree-name>`

**CRITICAL: Unity runs from the main repo, NOT the worktree!**
- After editing ANY scripts in a worktree, ALWAYS copy them to the main repo so Unity sees the changes
- Example: After editing `BoardRenderer.cs` in worktree, run:
  ```
  cp "C:\Users\Muzzy\.claude-worktrees\Glyphtender\bold-shirley\Unity\GlyphtenderUnity\Assets\Scripts\Unity\BoardRenderer.cs" "C:\Users\Muzzy\Documents\UnityProjects\Glyphtender\Unity\GlyphtenderUnity\Assets\Scripts\Unity\BoardRenderer.cs"
  ```
- This applies to ALL script files (.cs), not just .md files
- Muzzy may do manual editing on the main repo versions, so they are the source of truth for .md files
---

## Current Work

**Phase 5.4: Online Play Phase Bug Fixes** (IN PROGRESS - PC Build Host Issue)

Working on fixing online multiplayer bugs. Local 1v1 works. Most online combinations work.

### What's Working
- Auth → Lobby → Relay → Connection established
- Both players see board and can interact
- NetworkGameBridge spawns and syncs correctly
- Draft placements sync between players
- **Glyphling prefab system** - same object from hand → board (no destroy/recreate)
- **Tile prefab system** - same lifecycle as glyphlings!
- **Runeblossoms visible during refresh phase selection**
- **Local 1v1 fully working**
- **FIXED: Glyphling duplication in online mode** (v751)
- **FIXED: Cycle mode (refresh phase) now works in online mode** (v752)
- **FIXED: White borders on tiles/glyphlings in PC builds** (shader stripping)
- **Editor host → Phone joiner: WORKS**
- **Phone host → Editor joiner: WORKS**
- **Phone host → PC Build joiner: WORKS**

### Current Bug (v760)
**PC Build host → Phone joiner: FAILS**

The phone receives the correct relay code (verified: raw == cleaned, length = 6), but `JoinRelayAsync` fails with "join code not found".

**What's different about PC Build:**
- Same computer as Editor, same wifi network
- Editor hosting works fine, PC Build hosting fails
- Something in the build process is causing the relay allocation to not work properly

**Debugging tools added:**
- On-screen debug overlay on phone (shows CloudProjectId, relay codes, errors)
- Desktop debug file: `glyphtender_host_debug.txt` written when PC Build hosts
- PC Build logs at: `%USERPROFILE%\AppData\LocalLow\DefaultCompany\GlyphtenderUnity\Player.log`

### Current Testing (v760)
**Look for v760 in red text at top of main menu**

When PC Build hosts a game, check Desktop for `glyphtender_host_debug.txt` - it will show:
- Room code and Relay code allocated
- CloudProjectId
- Whether running in Editor or Build

### Remaining Issues
1. **P0: PC Build host → Phone joiner fails** - relay join code not found (under investigation)

---

## Known Issues

### P0 - Game Breaking
1. **PC Build host → Phone joiner fails** - Relay join code not found. Editor host works, PC Build host doesn't. Under investigation (v760).

### P1 - Minor
1. Glyphling duplication may still occur in play phase (needs investigation)
2. Hex directions may be incorrect for leyline movement

---

## Bug Prevention Protocol

**BEFORE fixing any bug:**
1. Re-read the relevant HANDOFF.md section (Turn Flow, Draft Flow, etc.)
2. Trace the documented flow step-by-step
3. Identify WHERE in the flow the bug occurs
4. ASK clarifying questions if symptoms are unclear
5. Only THEN write code

**Common pitfalls:**
- Unity Netcode ServerRpc executes **synchronously on host** - code after RPC call runs AFTER RPC handler
- Check `IsLocalPlayerTurn` before any player-specific UI/logic
- Ghost objects must be confirmed before RefreshBoard or they get orphaned
- `_glyphlingObjects` dictionary is the source of truth for preventing duplicates

---

## Unity Editor vs Build Differences

**When something works in Editor but not in builds, consider:**

1. **Shader stripping** - Shaders used only via `Shader.Find()` at runtime get stripped from builds
   - Fix: Add shader to **Edit → Project Settings → Graphics → Always Included Shaders**
   - Current project requires: `Unlit/Transparent`

2. **Texture import settings** - Editor may use different compression than builds
   - For transparent PNGs: ensure `alphaIsTransparency: 1` in .meta files

3. **Build logs** - PC builds write logs to:
   - `%USERPROFILE%\AppData\LocalLow\<CompanyName>\<ProductName>\Player.log`

**When fixing bugs, consider ALL of:**
- Code changes
- Unity Editor settings (Project Settings, Graphics, etc.)
- Asset import settings (.meta files)
- Build settings

---

## Quick Reference

### Turn Flow (Play Phase)
```
1. Select glyphling (click on board)
2. Move glyphling (drag to valid hex)
3. Cast tile (select from hand, place adjacent)
4. Score words (automatic)
5. IF words formed: Draw tiles → EndTurn → Next player
6. IF no words: Enter cycle mode → Discard up to 3 → Draw same amount → EndTurn → Next player
```

### Draft Flow
```
Snake draft: P1 → P2 → P2 → P1 (for 2 players)
1. CurrentDrafter selects glyphling from hand
2. Drag to valid hex → ShowGhostGlyphling
3. Confirm placement → ConfirmGhostGlyphling
4. Advance DraftPickNumber
5. When all placed: Phase → Play, fire OnDraftComplete
```

### Network Sync Points
- Draft placement: `SendDraftToNetwork()` → `OnNetworkDraftPlacementConfirmed()`
- Turn confirmation: `SendTurnToNetwork()` → `OnNetworkTurnConfirmed()`
- Cycle completion: `SendCycleToNetwork()` → `OnNetworkCycleConfirmed()`

---

## Known Bug Registry

### P0 - Game Breaking
(none currently)

### P1 - Confusing but playable
1. **Glyphling duplication (online)** - Sometimes duplicates appear during play phase. Needs investigation.

### P2 - Minor
1. **Hex directions may be incorrect** - Leyline movement paths may not work correctly.

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

### 2026-01-05 (Phase 5.4 - Online Play Phase Bug Fixes)
- Fixed glyphling/tile size on board (changed `glyphlingSize` from 1.0 to 1.8)
- Fixed runeblossom selection during refresh phase (uniform quad scaling)
- Fixed green square during tile drag (material reapplication)
- Fixed glyphling identity mismatch during draft (pass selected glyphling to PlaceDraftGlyphling)
- Fixed ghost tile not converting to permanent on confirm (removed premature HideGhostTile)
- Updated all tile size calculations to use `hexSize * glyphlingSize`
- Local 1v1 now fully working!
- **FIXED: Online glyphling duplication (v751)** - Host now applies draft locally + sends to network
- **FIXED: Cycle mode in online play (v752)** - Added network sync for refresh phase
- **FIXED: Cycle mode on wrong player (v753)** - Added IsLocalPlayerTurn check
- **FIXED: Turn not advancing (v754)** - Reset position BEFORE RPC (ServerRpc is synchronous on host)
- Added Bug Prevention Protocol and Quick Reference sections to CLAUDE.md
- **FIXED: White borders on tiles/glyphlings in PC builds** - Shader stripping issue
  - Changed SpriteLoader to use `Unlit/Transparent` shader (alpha blend instead of cutout)
  - Added `Unlit/Transparent` to Always Included Shaders in Graphics settings
  - Updated all texture .meta files with `alphaIsTransparency: 1`
  - Added "Unity Editor vs Build Differences" section to CLAUDE.md

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
