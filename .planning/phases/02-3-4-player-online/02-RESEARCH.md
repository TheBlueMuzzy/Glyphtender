# Phase 2: 3-4 Player Online - Research

**Researched:** 2026-01-09
**Status:** Ready for planning

## Executive Summary

Extending online multiplayer from 1v1 to 3-4 players is **largely straightforward** because:
1. The Core layer (GameState, GameRules) already fully supports 3-4 players
2. Unity Lobby supports variable `MAX_PLAYERS` up to 100
3. Unity Relay supports multiple clients connecting to a single host
4. ClientRpc broadcasts automatically go to ALL connected clients

The main work is in the Unity network layer - making the lobby UI support player count selection and waiting for multiple players.

---

## Current Architecture Analysis

### Core Layer (Already Works!)

**GameState.cs**
- `PlayerCount` property supports 2-4 players
- `ActivePlayers` yields the correct number of players
- `Player` enum already has: `Yellow=0, Blue=1, Purple=2, Pink=3`
- Hands, Scores, Glyphlings all keyed by player count
- `CurrentDrafter` snake draft logic works for any player count

**GameRules.cs**
- `CreateNewGameWithDraft()` takes `playerCount` parameter
- `EndTurn()` wraps using modulo: `(currentIndex + 1) % state.PlayerCount`
- Starting positions calculated for 3-4 players via `GetStartingPositionsForPlayerCount()`
- Draft placement validation works for any number of glyphlings

### Network Layer (Needs Changes)

**GlyphtenderLobby.cs** (line 66)
```csharp
private const int MAX_PLAYERS = 2;  // NEEDS TO BE CONFIGURABLE
```

Key points:
- `CreateLobbyAsync()` passes `MAX_PLAYERS` to `LobbyService.Instance.CreateLobbyAsync()`
- `IsFull` check uses `PlayerCount >= MAX_PLAYERS`
- Need to store desired player count in lobby data

**OnlineLobbyScreen.cs**
- Currently hardcoded for "ONLINE 1v1"
- `StartGame()` waits for `ConnectedClientsIds.Count < 2`
- Need UI for selecting 3 or 4 players
- Need to show slots filling (1/3, 2/3, 3/3)

**NetworkGameBridge.cs** (line 59-61)
```csharp
public bool IsHostPlayer => GlyphtenderLobby.Instance?.IsHost ?? IsHost;
public Player LocalPlayer => IsHostPlayer ? Player.Yellow : Player.Blue;  // NEEDS EXPANSION
public Player RemotePlayer => IsHostPlayer ? Player.Blue : Player.Yellow; // NEEDS EXPANSION
```

Key points:
- `GetPlayerFromClientId()` only returns Yellow/Blue
- Need mapping: `clientId 0 → Yellow, 1 → Blue, 2 → Purple, 3 → Pink`
- RPCs already broadcast to ALL clients (good!)

**NetworkedGameManager.cs** (line 217)
```csharp
LocalPlayer = isHost ? Player.Yellow : Player.Blue;  // NEEDS CLIENT ID MAPPING
```

Key points:
- Guest always becomes Blue currently
- Need to determine player based on join order / client ID

### Unity Layer

**MainMenuScreen.cs**
- PlayMode enum has `Online1v1` - add `Online3P`, `Online4P` or make it configurable

**GameManager.cs**
- Uses `SettingsManager.Instance.PlayMode` to determine player count
- `CreateNewGameWithDraft()` call needs correct player count for online

---

## What Needs to Change

### 1. Lobby - Player Count Selection

**GlyphtenderLobby.cs**
- Remove hardcoded `MAX_PLAYERS = 2`
- Add `int TargetPlayerCount` property
- Store player count in lobby data for guests to read
- Update `IsFull` to use configurable count

**OnlineLobbyScreen.cs**
- Add player count selector (3P / 4P buttons or toggle)
- Update title from "ONLINE 1v1" to show selected count
- Show slot status: "Waiting for players (1/3)", "Waiting for players (2/3)"
- `StartGame()` wait condition: `ConnectedClientsIds.Count < targetPlayerCount`

### 2. Client-to-Player Mapping

**NetworkGameBridge.cs**
- Expand `GetPlayerFromClientId()`:
  ```csharp
  private Player GetPlayerFromClientId(ulong clientId)
  {
      // Client IDs are assigned in join order
      // Host = 0 = Yellow, Guest1 = 1 = Blue, Guest2 = 2 = Purple, Guest3 = 3 = Pink
      return clientId switch
      {
          0 => Player.Yellow,
          1 => Player.Blue,
          2 => Player.Purple,
          3 => Player.Pink,
          _ => Player.Yellow  // Fallback
      };
  }
  ```
- Update `LocalPlayer` to use client ID

**NetworkedGameManager.cs**
- Determine `LocalPlayer` from `NetworkManager.Singleton.LocalClientId`
- Use same mapping logic as NetworkGameBridge

### 3. Initial Game State Sync

**NetworkGameBridge.cs / NetworkedGameManager.cs**
- `NetworkGameStart` struct needs hands for Purple/Pink
- Host broadcasts all hands, each client applies only their own
- Alternative: Each player draws their own hand (sync tile bag order only)

Current `NetworkGameStart` (in NetworkDataTypes.cs likely):
```csharp
public struct NetworkGameStart
{
    public string TileBagOrder;
    public string YellowHand;
    public string BlueHand;  // Need PurpleHand, PinkHand
    public int BoardSizeIndex;
    public bool Allow2LetterWords;
}
```

**Recommended approach:** Sync only tile bag order. Each client draws their own hand from the synced bag in the same order. This automatically scales to any player count.

### 4. Settings/PlayMode

**MainMenuScreen.cs / SettingsManager.cs**
- Option A: Add `Online3P`, `Online4P` to PlayMode enum
- Option B: Keep `Online` and add separate player count setting
- Either way, need UI to select player count before creating room

### 5. Rematch Flow

**RematchManager.cs / EndGameScreen.cs**
- Currently tracks 2 players
- Need to track all active players
- Rematch requires ALL players to confirm (or majority?)
- Timer resets when first player confirms

---

## Implementation Order Recommendation

1. **GlyphtenderLobby changes** - Make player count configurable
2. **OnlineLobbyScreen UI** - Player count selection, slot display
3. **Client-Player mapping** - NetworkGameBridge + NetworkedGameManager
4. **NetworkGameStart expansion** - Handle 3-4 player hands
5. **PlayMode/Settings** - MainMenuScreen updates
6. **Rematch updates** - EndGameScreen for 3-4 players
7. **Testing** - Full flow with 3-4 players

---

## Risk Assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Client ID assignment | Medium - Need to verify client IDs are assigned in join order | Test thoroughly; Unity Netcode docs confirm this behavior |
| Relay scalability | Low - Unity Relay supports many clients | Already handles 1+1, 1+3 is similar |
| Tile bag sync | Low - Current approach works | Extend NetworkGameStart or sync bag only |
| Turn order validation | Low - Already uses modulo | `ValidateClientTurn()` needs player count awareness |
| Lobby player tracking | Low - Unity Lobby handles this | Just check `PlayerCount` against target |

---

## Questions for Planning Phase

1. Should "3P Online" and "4P Online" be separate PlayMode entries, or one "Online" mode with a count selector?
2. For rematch: Require all players to confirm, or start with any 2+?
3. Should disconnected player slots be replaceable mid-lobby (before game starts)?

---

*Phase: 02-3-4-player-online*
*Research completed: 2026-01-09*
