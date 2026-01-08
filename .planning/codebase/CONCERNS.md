# Codebase Concerns

**Analysis Date:** 2026-01-08

## Tech Debt

**BoardRenderer is a God Class:**
- Issue: Single file handles hex creation, tile rendering, glyphling rendering, highlights, ghost objects, hover effects, trapped pulsing
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/BoardRenderer.cs` (900+ lines)
- Why: Organic growth during development
- Impact: Hard to maintain, any change risks breaking multiple systems
- Fix approach: Split into BoardHexRenderer, TileRenderer, GlyphlingRenderer, HighlightManager

**Static Input State in Drag Handlers:**
- Issue: `IsDraggingTile`, `IsDraggingGlyphling`, `CurrentlyPlacedTile` are static
- Files: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/InputStateManager.cs`, `HexDragHandler.cs`, `HandTileDragHandler.cs`
- Why: Simplified initial implementation
- Impact: Blocks future 3-4 player online with multiple local players
- Fix approach: Instance-based input state per player

**Hard-Coded Animation Timing:**
- Issue: `WaitForSeconds(0.6f)`, `WaitForSeconds(0.5f)`, etc. scattered in network code
- Files: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkedGameManager.cs:436,449,476`
- Why: Quick implementation
- Impact: Hard to tune animations, values duplicated
- Fix approach: Extract to AnimationConfig or const fields

## Known Bugs

**(None currently tracked - bugs discovered during testing will be added here)**

## Security Considerations

**Client-Side Trust Model:**
- Risk: Host accepts all moves without validation
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkGameBridge.cs:272-274`
- Current mitigation: "For now, return true" - friends-only game acceptable
- Recommendations: Implement ValidateMove() before public release

**No Move Validation in NetworkGameBridge:**
- Risk: Malicious client could send invalid moves
- Files: `NetworkGameBridge.cs:103,124` (TODO comments)
- Current mitigation: None (trust client)
- Recommendations: Add GameRules.IsValidMove() calls in ServerRpc handlers

## Performance Bottlenecks

**No GameObject Pooling:**
- Problem: Hex tiles, glyphlings, tiles created/destroyed repeatedly
- Measurement: Not measured, but GC spikes likely
- Cause: Instantiate/Destroy pattern instead of pooling
- Improvement path: Implement object pooling for board elements

**Coroutine Leak Risk:**
- Problem: Network animation coroutines not tracked
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkedGameManager.cs:417`
- Cause: StartCoroutine() without cancellation token
- Improvement path: Track active coroutines, cancel on disconnect

## Fragile Areas

**Network Initialization Sequence:**
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkedGameManager.cs:103-110`
- Why fragile: Update() loop retries event subscription without backoff
- Common failures: Race condition if GameManager not ready
- Safe modification: Add attempt counter or exponential backoff
- Test coverage: None

**Unity Relay Host Binding Timing:**
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/OnlineLobbyScreen.cs`
- Why fragile: Host must bind before guest joins (v778 fix)
- Common failures: Cross-network "join code not found" if timing wrong
- Safe modification: Follow documented pattern in CLAUDE.md
- Test coverage: Manual testing only

## Missing Critical Features

**Forfeit Handling Not Implemented:**
- Problem: `OnNetworkForfeitReceived()` has TODO - no actual logic
- File: `Unity/GlyphtenderUnity/Assets/Scripts/Unity/Network/NetworkedGameManager.cs:693`
- Current workaround: None (forfeit doesn't work)
- Blocks: Phase 5.4 completion
- Implementation complexity: Medium

**ConnectionMonitor Not Implemented:**
- Problem: Heartbeat and timeout detection missing
- File: Referenced in HANDOFF.md but doesn't exist
- Current workaround: Game hangs if player disconnects
- Blocks: Robust online play
- Implementation complexity: Medium

**Rematch Flow Not Implemented:**
- Problem: No way to rematch after online game
- Current workaround: Return to menu, recreate room
- Blocks: Phase 5.5 completion
- Implementation complexity: Low-Medium

## Test Coverage Gaps

**No Unit Tests for Core Logic:**
- What's not tested: GameRules, WordScorer, TangleChecker, AIBrain
- Risk: Regressions in complex rules go undetected
- Priority: High
- Difficulty to test: Low (Core is pure C#, easily testable)

**No Network Integration Tests:**
- What's not tested: Full online game flow, edge cases
- Risk: Network sync bugs only found in manual testing
- Priority: Medium
- Difficulty to test: Medium (requires mocking or Unity Test Framework)

## Dependencies at Risk

**None Currently:**
- UGS packages are actively maintained
- Unity 2022 LTS has long support window

## Scaling Limits

**Unity Gaming Services Free Tier:**
- Current capacity: 50 CCU (concurrent users) on Relay
- Limit: 25 simultaneous games
- Symptoms at limit: New games fail to allocate relay
- Scaling path: UGS paid tier

## Documentation Gaps

**Network Architecture Decisions:**
- Why `GlyphtenderLobby.IsHost` instead of `NetworkManager.IsHost`?
- How should 3-player online work?
- Not centrally documented

**State Machine Transitions:**
- `GameTurnState` has valid transitions but no documented state graph
- Risk: Future changes could break valid transitions

---

*Concerns audit: 2026-01-08*
*Update as issues are fixed or new ones discovered*
