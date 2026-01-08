# Plan 01-01 Summary: Rematch State & Network Sync

**Completed:** 2026-01-08
**Duration:** Single session

## What Was Built

### Task 1: RematchManager Class
Created `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/RematchManager.cs`:

- **RematchStatus enum**: `Pending`, `Confirmed`, `Declined`
- **Singleton pattern** matching GameManager
- **State tracking**:
  - `Dictionary<Player, RematchStatus>` for per-player status
  - Timer fields with configurable duration (30s default)
  - Resolution prevention flag
- **Events**:
  - `OnPlayerStatusChanged` - UI updates when player changes status
  - `OnTimerStarted` - Timer countdown begins
  - `OnTimerExpired` - Timer reached zero
  - `OnRematchConfirmed` - 2+ players confirmed, passes player list
  - `OnRematchCancelled` - Not enough players
- **Key behaviors**:
  - Timer starts when first player confirms
  - Toggle support (Confirmed → Pending → Confirmed)
  - Early completion when all players decide
  - Early cancellation when 2+ confirmed becomes impossible

### Task 2: Network Messaging & Sync

**NetworkMessages.cs** - Added `NetworkRematchStatus` struct:
```csharp
public struct NetworkRematchStatus : INetworkSerializable
{
    public byte PlayerIndex;        // 0=Yellow, 1=Blue, 2=Purple, 3=Pink
    public byte Status;             // 0=Pending, 1=Confirmed, 2=Declined
    public float TimerStartTime;    // Server time when timer started
    public float TimerDuration;     // Duration in seconds
}
```

**NetworkGameBridge.cs** - Added RPCs:
- `RequestRematchStatusServerRpc()` - Client sends status change, host validates sender and sets timer if first confirm
- `BroadcastRematchStatusClientRpc()` - Host broadcasts validated status to all clients
- `OnRematchStatusReceived` event for subscribers

**NetworkedGameManager.cs** - Added subscription:
- Subscribes to `OnRematchStatusReceived`
- Handler updates local RematchManager with received status
- Syncs timer state from network if not already active

## Files Changed

| File | Change |
|------|--------|
| `Network/RematchManager.cs` | **NEW** - State manager for rematch flow |
| `Network/NetworkMessages.cs` | Added `NetworkRematchStatus` struct |
| `Network/NetworkGameBridge.cs` | Added RPC pair + event |
| `Network/NetworkedGameManager.cs` | Added subscription + handler |

## Architecture Decisions

1. **Host-authoritative model**: Clients send status via ServerRpc, host validates sender matches player index before broadcasting
2. **Timer on first confirm**: Host sets `TimerStartTime` when first Confirmed status arrives with zero timer
3. **Flexible player count**: RematchManager tracks statuses for all active players, supports 2-4 players independently
4. **Event-driven**: All UI updates happen via events, keeping state and presentation separate

## Ready for Plan 01-02

The network layer is complete. Plan 01-02 will:
1. Add rematch UI to EndGameScreen (toggle button, decline button, timer display)
2. Add player status indicators (X/Check marks)
3. Wire completion logic (start new game or return to menu)

## Verification

- [x] RematchManager.cs compiles
- [x] NetworkRematchStatus struct serializes correctly
- [x] NetworkGameBridge has new RPCs
- [x] NetworkedGameManager subscribes to rematch events
