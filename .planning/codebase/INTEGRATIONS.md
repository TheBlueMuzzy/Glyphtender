# External Integrations

**Analysis Date:** 2026-01-08

## Unity Gaming Services (UGS)

### Authentication Service
- **Package:** `com.unity.services.authentication@3.5.2`
- **Key File:** `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkServices.cs`
- **Auth Method:** Anonymous (no login required)
- **Implementation:** `AuthenticationService.Instance.SignInAnonymouslyAsync()`
- **Public API:**
  - `bool IsSignedIn` - Check auth status
  - `string PlayerId` - Anonymous player ID

### Lobby Service
- **Package:** `com.unity.services.lobby@1.3.0`
- **Key File:** `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/GlyphtenderLobby.cs`
- **Features:**
  - Create lobbies with 6-character room codes
  - Join lobbies by room code
  - Store game settings in lobby data
  - Heartbeat mechanism (15-second interval)
  - Lobby polling (1.5-second interval)
- **Max Players:** 2 (1v1 multiplayer)
- **Public API:**
  - `Task<string> CreateLobbyAsync(LobbyGameSettings)` - Host creates room
  - `Task<bool> JoinLobbyByCodeAsync(string)` - Guest joins room
  - `Lobby CurrentLobby` - Active lobby reference
  - `string RoomCode` - 6-character code
  - `bool IsHost` - Host/guest status

### Relay Service (NAT Traversal)
- **Package:** `com.unity.services.relay@1.2.0`
- **Key File:** `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/GlyphtenderRelay.cs`
- **Purpose:** Enable cross-network play (different WiFi/networks)
- **Architecture:**
  - Host allocates relay → receives join code → shares via lobby
  - Guest joins relay using code
  - Both connect through Unity relay servers
- **Critical Timing:** Host must `StartHost()` before sharing join code (v778 fix)
- **TTLs:**
  - Client: 10 seconds before disconnect
  - Idle Host: 60 seconds after bind
- **Public API:**
  - `Task<string> AllocateRelayAsync()` - Host allocates
  - `Task JoinRelayAsync(string)` - Guest joins
  - `bool IsHost` - Host status
  - `RelayState State` - Connection state

### QoS Service
- **Package:** `com.unity.services.qos@1.3.2`
- **Purpose:** Region selection for relay servers
- **Usage:** Called before relay allocation in standalone builds
- **Fix Applied:** v764 - explicit region selection for PC builds

## Networking Stack

### Netcode for GameObjects
- **Package:** `com.unity.netcode.gameobjects@1.15.0`
- **Key Files:**
  - `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkBootstrap.cs`
  - `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkGameBridge.cs`
  - `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkedGameManager.cs`
- **Architecture:**
  - Host/Client model
  - NetworkManager singleton
  - NetworkBehaviour for synced objects
- **RPC Pattern:**
  - ServerRpc: Client → Host
  - ClientRpc: Host → All Clients

### Network Message Types
**File:** `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkMessages.cs`

| Message | Purpose |
|---------|---------|
| `NetworkDraftPlacement` | Draft phase placement (includes GlyphlingIndex) |
| `NetworkTurnData` | Complete turn (move + cast) |
| `NetworkCycleData` | Cycle/discard phase completion |
| `NetworkHexCoord` | Serializable hex coordinate |

## Data Storage

**Databases:**
- None (no server-side storage)

**File Storage:**
- PlayerPrefs - Settings persistence
- JSON file - Game statistics (`StatsPersistence.cs`)

**Caching:**
- In-memory only

## Authentication & Identity

**Auth Provider:**
- Unity Authentication Service (anonymous)
- No login UI required
- PlayerId assigned automatically

**OAuth Integrations:**
- None (anonymous only)

## Monitoring & Observability

**Error Tracking:**
- None (Debug.Log only)

**Analytics:**
- None configured

**Logs:**
- Unity Debug.Log to console
- PC builds: `%USERPROFILE%\AppData\LocalLow\DefaultCompany\GlyphtenderUnity\Player.log`

## CI/CD & Deployment

**Hosting:**
- Local builds only (no cloud hosting)
- Android APK builds
- PC standalone builds

**CI Pipeline:**
- None configured

## Environment Configuration

**Development:**
- Unity Editor with Play mode
- No environment variables required
- UGS configured via Unity Dashboard

**Production:**
- Same as development (no separate environments)
- UGS production environment

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Future Integrations (Planned)

Per HANDOFF.md roadmap:
- Steam Integration (Phase 7)
- Google Play Store (Phase 7)
- iOS App Store (Phase 7)
- Account System (Phase 8)
- Leaderboards (Phase 8)

---

*Integration audit: 2026-01-08*
*Update when adding/removing external services*
