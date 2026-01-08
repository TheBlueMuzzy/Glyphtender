# Architecture

**Analysis Date:** 2026-01-08

## Pattern Overview

**Overall:** Clean Core/Unity Separation with Host-Authoritative Multiplayer

**Key Characteristics:**
- Pure C# game logic in Core layer (no Unity dependencies)
- Unity layer handles rendering, input, platform-specific code
- Host-authoritative networking with ServerRpc/ClientRpc pattern
- Event-driven state updates
- Singleton managers for global access

## Layers

**Core Layer (Pure C#):**
- Purpose: Game logic, rules validation, AI decision-making
- Contains: GameState, GameRules, Board, WordScorer, AIBrain, Stats
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Core/`
- Depends on: Nothing (pure C#, no Unity references)
- Used by: Unity layer, can be unit tested without Unity

**Unity Layer (Platform-Specific):**
- Purpose: Rendering, input handling, UI, camera control
- Contains: GameManager, BoardRenderer, HandController, Screens, Controllers
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/`
- Depends on: Core layer, Unity Engine
- Used by: Unity runtime

**Network Layer (Multiplayer):**
- Purpose: Online game synchronization, lobby/relay management
- Contains: NetworkGameBridge, NetworkedGameManager, GlyphtenderLobby, GlyphtenderRelay
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/`
- Depends on: Unity layer, Core layer, Unity Netcode
- Used by: Online play mode

## Data Flow

**Local Turn Execution:**
1. Player Input (click/drag) → HexClickHandler/HexDragHandler
2. GameManager.SelectGlyphling() / SelectDestination() / SelectCastPosition()
3. GameManager.ConfirmTurn()
4. GameRules.ExecuteTurn() (pure C# logic)
5. GameState updated
6. GameManager.OnGameStateChanged event fired
7. BoardRenderer.RefreshBoard() (visual update)

**Online Turn Execution:**
1. Player Input → NetworkedGameManager intercepts
2. NetworkGameBridge.RequestTurnServerRpc() (client to host)
3. Host validates move
4. NetworkGameBridge.OnTurnConfirmedClientRpc() (host to all)
5. NetworkedGameManager.OnNetworkTurnConfirmed() on each client
6. Local GameManager applies move
7. BoardRenderer updates

**State Management:**
- GameState is immutable snapshot (can be cloned for AI lookahead)
- GameManager maintains authoritative state
- Network syncs via serializable message structs
- Event-driven updates (no polling)

## Key Abstractions

**GameState:**
- Purpose: Immutable game snapshot (board, tiles, glyphlings, hands, scores)
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Core/GameState.cs`
- Pattern: Data class with Clone() for AI simulation

**GameManager (Singleton):**
- Purpose: Central game controller, state machine
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/GameManager.cs`
- Pattern: Singleton with event broadcasting

**NetworkGameBridge (NetworkBehaviour):**
- Purpose: RPC handler for network sync
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkGameBridge.cs`
- Pattern: Host-authoritative with ServerRpc/ClientRpc

**AI System:**
- Purpose: Goal-based AI with 7 distinct personalities
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Core/AIBrain.cs`
- Pattern: Perception → Goal Selection → Move Evaluation

## Entry Points

**Scene Entry:**
- Location: `Unity/GlyphtenderUnity/Assets/Scenes/GameScene.unity`
- Triggers: Unity scene load
- Responsibilities: Contains all MonoBehaviours, initializes game

**Network Bootstrap:**
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkBootstrap.cs`
- Triggers: RuntimeInitializeOnLoadMethod (BeforeSceneLoad)
- Responsibilities: Creates NetworkManager, network singletons

**Game Start:**
- Location: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/MainMenuScreen.cs`
- Triggers: User clicks Play
- Responsibilities: Configure game settings, call GameManager.InitializeGame()

## Error Handling

**Strategy:** Minimal exception handling, rely on Unity's error logging

**Patterns:**
- Debug.Log/LogError for diagnostic output
- Null-conditional operators (?.) for safety
- Event subscription guards in network code

## Cross-Cutting Concerns

**Logging:**
- Debug.Log throughout for development
- ~100+ Debug.Log statements across codebase
- No production logging framework

**Validation:**
- GameRules provides static validation functions
- Network validation incomplete (TODO items in NetworkGameBridge)

**State Synchronization:**
- NetworkedGameManager subscribes to GameManager events
- Intercepts local actions for online mode
- Broadcasts via NetworkGameBridge RPCs

---

*Architecture analysis: 2026-01-08*
*Update when major patterns change*
