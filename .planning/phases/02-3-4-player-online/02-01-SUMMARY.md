---
phase: 02-3-4-player-online
plan: 01
subsystem: network
tags: [unity-lobby, multiplayer, 3d-ui]

# Dependency graph
requires:
  - phase: 01-online-mp-polish
    provides: Online 1v1 lobby and relay infrastructure
provides:
  - Configurable player count in GlyphtenderLobby (2, 3, or 4)
  - Player count selector UI in OnlineLobbyScreen
  - Slot status display (1/3, 2/3, 3/3 format)
affects: [02-02, 02-03, rematch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Small toggle buttons for player count selection
    - Player count stored in Unity Lobby data

key-files:
  created: []
  modified:
    - Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/GlyphtenderLobby.cs
    - Unity/GlyphtenderUnity/Assets/Scripts/Unity/OnlineLobbyScreen.cs

key-decisions:
  - "Player count stored in lobby data so guests can read target"
  - "IsFull uses dynamic TargetPlayerCount instead of hardcoded MAX_PLAYERS"
  - "Player count selector visible in ChooseRole state before Create Room"

patterns-established:
  - "CreateSmallButton pattern for toggle-style selectors in 3D UI"
  - "Player count flows: Lobby selector -> CreateLobbyAsync -> lobby data -> guests read on join"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-09
---

# Phase 02-01: Lobby Player Count Selection Summary

**Configurable 2/3/4 player count selector in online lobby with slot status display**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-09
- **Completed:** 2026-01-09
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GlyphtenderLobby now accepts configurable player count (2, 3, or 4)
- OnlineLobbyScreen shows player count selector with visual highlighting
- Slot status displays live count (e.g., "Waiting for players (2/3)")
- StartGame waits for correct number of players before proceeding

## Task Commits

Each task was committed atomically:

1. **Task 1: Make GlyphtenderLobby player count configurable** - `54fe1d3` (feat)
2. **Task 2: Add player count selection and slot display to OnlineLobbyScreen** - `a96217a` (feat)

**Plan metadata:** `38b3c25` (docs: complete plan)

## Files Created/Modified
- `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/GlyphtenderLobby.cs` - Added TargetPlayerCount property, configurable CreateLobbyAsync, dynamic IsFull
- `Unity/GlyphtenderUnity/Assets/Scripts/Unity/OnlineLobbyScreen.cs` - Added player count selector UI, slot display, dynamic wait condition

## Decisions Made
- Removed hardcoded MAX_PLAYERS constant in favor of TargetPlayerCount property
- Player count stored in lobby data under "playerCount" key for guests to read
- UI title changes based on player count: "ONLINE 1v1", "ONLINE 3P", "ONLINE 4P"

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- Lobby now supports 2, 3, or 4 player rooms
- Ready for Phase 02-02: Client-to-player mapping
- NetworkGameBridge and NetworkedGameManager still need updating for 3-4 players

---
*Phase: 02-3-4-player-online*
*Plan: 01 - Lobby Player Count Selection*
*Completed: 2026-01-09*
