# Glyphtender - Claude Code Guide

## Quick Commands
| Command | Action |
|---------|--------|
| **"commit"** | Stage all, commit with message, update both .md files, push |
| **"status"** | Show git status and current work summary |
| **"push"** | Push commits to remote |
| **"look at handoff"** | Read HANDOFF.md for deep context |
| **`<claude>`** | Explicit: add following info to CLAUDE.md |
| **`<handoff>`** | Explicit: add following info to HANDOFF.md |

---

## Capturing User Context

**Proactively capture important information Muzzy shares:**
- If he mentions design decisions, preferences, or insights worth preserving → add to appropriate .md file
- Use judgment: not everything needs documenting, but vision/decisions/learnings should be captured
- `<claude>` and `<handoff>` are explicit commands, but you should recognize important info without them

---

## Session Workflow

### Starting a Session
1. Read this file (CLAUDE.md) for current state
2. Check git log for recent changes
3. If user says "look at handoff" → read HANDOFF.md for full project context

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
6. **IMPORTANT:** If in a worktree, also update the main repo copy

### File Sync (Worktrees)
Main repo: `C:\Users\Muzzy\Documents\UnityProjects\Glyphtender`
After editing .md files in a worktree, copy to main repo and commit both.

---

## Current Work

**Phase 5.4: Online Draft Sync** (IN PROGRESS)

Connection works. Both players connect and see the board. Fixing draft phase sync issues.

### What's Working
- Auth → Lobby → Relay → Connection established
- Both players see board and can interact
- NetworkGameBridge now has NetworkObject and gets spawned

### What Needs Testing
1. **LocalPlayer assignment** - Guest should be Blue, not Yellow
   - Check: `[NetworkedGameManager] GlyphtenderLobby.IsHost = false` for guest
   - Check: `[NetworkedGameManager] Online game started. isHost=false, LocalPlayer=Blue`

2. **Hand visibility** - P2 should see empty hand while waiting for P1
   - Check: `[HandController] RefreshDraftHand: Not our turn, hiding hand`

3. **Turn indicator** - Should show "Your turn" for active player, player name for others

4. **Draft sync** - P1's placement should replicate to P2
   - Check: `[NetworkGameBridge] Draft placement confirmed`
   - Check: `[NetworkedGameManager] Applied draft placement`

### Key Debug Logs to Watch
```
[NetworkedGameManager] OnGameInitialized called. PlayMode=Online1v1, HasNetworkSession=True
[NetworkedGameManager] GlyphtenderLobby.IsHost = true/false
[NetworkedGameManager] Online game started. isHost=..., LocalPlayer=...
[HandController] RefreshDraftHand: displayPlayer=..., IsOnlineGame=..., LocalPlayer=...
[OnlineLobbyScreen] NetworkGameBridge spawned on network
```

---

## Known Issues

1. **Hex directions may be incorrect** - Leyline movement paths may not work correctly. Need to verify `HexCoord.Directions` array.

2. **Online Draft Bugs** (Phase 5.4 - being fixed):
   - Turn indicator may show "Yellow's turn" instead of "Your turn"
   - P2 may see yellow glyphlings (should see nothing while waiting)
   - Draft placements may not sync between players

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

### 2026-01-04 (Phase 5.4)
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
