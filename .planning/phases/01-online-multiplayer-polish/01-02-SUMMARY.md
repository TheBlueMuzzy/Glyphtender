# Plan 01-02 Summary: Rematch UI & Completion Logic

**Completed:** 2026-01-08
**Duration:** Single session

## What Was Built

### Task 1: Updated EndGameScreen Buttons and Timer Display

Modified `EndGameScreen.cs` to show rematch flow UI for online games:

- **Rematch button**: Toggles between "Rematch?" (gray) and "Rematch! XXs" (green with countdown)
- **Decline button**: Returns player to main menu and sends Declined status
- **Timer display**: Shows "Waiting... XXs" when timer is active
- **Conditional rendering**: Local games still show "Play Again", online games show rematch flow

Key additions:
- `CreateRematchButton()` - Creates toggle button with color change on click
- `CreateDeclineButton()` - Creates decline button that exits to menu
- `CreateTimerDisplay()` - Creates countdown text (hidden until timer starts)
- `OnRematchButtonClicked()` - Toggles status and sends via network
- `OnDeclineButtonClicked()` - Sends declined status and exits
- `UpdateRematchButtonVisual()` - Updates button appearance based on state

### Task 2: Added Player Status Indicators

- X/Check marks appear above player names in stats column
- Checkmark (green) for Confirmed players
- X mark (red) for Declined players
- Hidden for Pending players
- `CreatePlayerStatusIndicator()` - Creates TextMesh for each player
- `_playerStatusIndicators` dictionary tracks them for updates

### Task 3: Implemented Rematch Completion Logic

Added event subscriptions and handlers:

- **`SubscribeToRematchEvents()`**: Creates RematchManager if needed, subscribes to events
- **`UnsubscribeFromRematchEvents()`**: Cleans up subscriptions
- **`OnPlayerRematchStatusChanged()`**: Updates status indicators and button state
- **`OnRematchConfirmed()`**: Hides screen, host starts new game
- **`OnRematchCancelled()`**: Hides screen, returns to main menu
- **`OnRematchTimerExpired()`**: Logs expiration (RematchManager handles resolution)
- **`CleanupAndReturnToMenu()`**: Leaves lobby, disconnects relay, shows menu

## Files Changed

| File | Change |
|------|--------|
| `EndGameScreen.cs` | Added rematch UI, indicators, event handling |

## Key Implementation Details

1. **Online vs Local Detection**: `NetworkedGameManager.Instance?.IsOnlineGame` determines which buttons to show

2. **Lazy RematchManager Creation**: `SubscribeToRematchEvents()` creates RematchManager GameObject if it doesn't exist

3. **Timer Updates in Update()**: The Update loop handles:
   - Updating timer text when active
   - Updating rematch button text with countdown if confirmed
   - Showing timer display when timer starts

4. **Network Communication**: Uses `NetworkRematchStatus` struct via `NetworkGameBridge.RequestRematchStatusServerRpc()`

## Phase 1 Complete

Both plans for Phase 1 (Online Multiplayer Polish) are now complete:
- Plan 01-01: Rematch State & Network Sync ✅
- Plan 01-02: Rematch UI & Completion Logic ✅

## Verification Checklist

- [x] Rematch button toggles state and appearance
- [x] Decline button returns player to main menu
- [x] Timer display shows countdown when active
- [x] Player status indicators (X/Check) update in real-time
- [x] 2+ confirmed players → new game starts
- [x] < 2 players → returns to main menu
- [x] Local games still use "Play Again" button

## Notes for Testing

The human verification checkpoint in the plan should test:
1. Two online players can both click Rematch
2. Timer appears and counts down
3. Both see each other's checkmarks
4. Both confirmed → new game starts
5. One declines → both return to menu
6. Timer expires with only 1 confirmed → cancelled
