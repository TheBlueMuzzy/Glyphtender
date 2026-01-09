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
| **`<bug>`** | Add/update known bugs in HANDOFF.md's Known Bugs section. When bugs are fixed, remove them from that section. |
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
- **Context awareness:** Proactively commit and update docs before context fills up - don't leave Muzzy stranded mid-task

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

**Phase 1: Online Multiplayer Polish** - COMPLETE

### Completed This Session
- Rematch flow bugs fixed and verified working (v786):
  - Fixed orphaned tile on cancel (RetrackTileObject)
  - Fixed LocalPlayer wrong after rematch (use NetworkManager.IsHost for rematch)
  - Fixed timer restarting after rematch resolved (check GameTurnState.GameOver)

### What's Working
- Online 1v1 fully working (cross-network confirmed!)
- Local 1v1, 3p, 4p fully working
- 4-player win screen with all stats
- Tangle detection and game end in online mode
- **Rematch flow for online games** (VERIFIED v786)
  - "Rematch?" button toggles to green "Rematch! XXs"
  - Timer starts when first player confirms (30s)
  - Players can toggle on/off (change mind)
  - Decline button returns to menu
  - X/Check indicators show player status
  - New game starts correctly with proper player assignments

### Next Up
- Phase 2: 3-4 Player Online

### Current Version: v786

---

## Known Bugs

(none currently tracked - bugs discovered during testing will be added here)

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

4. **Unity Relay QoS region selection** - Automatic region selection can fail in standalone builds
   - Fix: Explicitly call `ListRegionsAsync()` and pass region to `CreateAllocationAsync()`
   - This was the root cause of "join code not found" errors in PC builds (v764 fix)

5. **Unity Relay host binding timing** - Allocation must be "active" (host bound) before guests can join
   - See "Unity Relay Cross-Network Fix" section below

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

## Repository
https://github.com/TheBlueMuzzy/Glyphtender/

## For Deep Context
Read **HANDOFF.md** for:
- Full game rules and mechanics
- AI system design details
- Architecture documentation
- Complete roadmap and backlog
- Design principles and philosophy

---

## Unity Relay Cross-Network Fix (v778)

**Problem:** Online multiplayer worked on same WiFi but failed with "join code not found" on different networks.

**Root Cause:** Unity Relay allocations have two states:
1. **Allocated** - Exists on Unity's servers, has a join code
2. **Active/Bound** - Host has called `StartHost()` and is listening

The original flow was:
```
1. Host: AllocateRelay → get join code → store in lobby → wait for guest
2. Guest joins lobby → triggers StartGame() on both
3. Host: StartHost() (NOW binds to relay)
4. Guest: JoinRelayAsync() → FAILS (host not bound yet on cross-network)
```

On same-WiFi, local network speed meant host often bound before guest's request arrived. On cross-network, the extra latency meant guest's request hit Unity's servers before host was bound.

**Fix:** Start host immediately after allocation, before sharing the join code:
```
1. Host: AllocateRelay → StartHost() → wait 1s → store join code in lobby
2. Guest joins lobby → gets relay code → JoinRelayAsync() → SUCCESS
```

**Key Files:**
- `OnlineLobbyScreen.cs:OnCreateRoomClicked()` - Now calls `ConfigureTransportAndStart()` immediately after allocation
- `OnlineLobbyScreen.cs:StartGame()` - Host path simplified (no longer starts host here)

**Unity Relay TTLs (from docs):**
- Client TTL: 10 seconds (before disconnect)
- Idle Host TTL: 60 seconds (after BIND but before peer CONNECT)
