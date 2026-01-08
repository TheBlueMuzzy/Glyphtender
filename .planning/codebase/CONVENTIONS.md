# Coding Conventions

**Analysis Date:** 2026-01-08

## Naming Patterns

**Files:**
- PascalCase for all C# files: `GameManager.cs`, `BoardRenderer.cs`
- Suffix patterns: `*Screen.cs`, `*Handler.cs`, `*Controller.cs`, `*Manager.cs`

**Classes/Types:**
- PascalCase: `GameManager`, `BoardRenderer`, `NetworkedGameManager`
- No prefixes (no I for interfaces, no C for classes)
- Enum suffix: `GamePhase`, `GameTurnState`, `PlayMode`

**Methods:**
- PascalCase: `InitializeGame()`, `GetValidMoves()`, `ChooseMove()`
- Event handlers: `On*` prefix: `OnGameInitialized()`, `OnGameStateChanged()`

**Properties:**
- PascalCase: `Instance`, `GameState`, `IsOnlineGame`, `LocalPlayer`

**Private Fields:**
- camelCase with underscore prefix: `_aiManager`, `_menuRoot`, `_wordScorer`
- Example: `_subscribedToNetworkEvents`, `_glyphlingObjects`

**Local Variables:**
- camelCase: `boardSize`, `playerCount`, `candidates`

**Constants:**
- PascalCase (Unity style): `HandSize`, `GlyphlingsPerPlayer`
- Static readonly: `DirectionsEvenCol`, `DirectionsOddCol`

## Code Style

**Formatting:**
- 4-space indentation
- Allman style braces (opening brace on new line)
- No explicit formatting tool configured

**Linting:**
- No .editorconfig at project root
- No .ruleset file
- Relies on Visual Studio/Rider defaults

## Import Organization

**Order:**
1. System namespaces
2. Unity namespaces (UnityEngine, Unity.*)
3. Third-party namespaces
4. Project namespaces (Glyphtender.*)

**Grouping:**
- Blank line between namespace groups
- No strict alphabetical sorting

**Namespaces Used:**
- `Glyphtender.Core` - Pure game logic
- `Glyphtender.Unity` - Unity-specific code
- `Glyphtender.Core.Stats` - Statistics subsystem
- `Glyphtender.Unity.Network` - Network code

## Error Handling

**Patterns:**
- Minimal try-catch (only 11 blocks across 58 files)
- Rely on Unity's error logging
- Null-conditional operators (?.) for safety

**Logging:**
- `Debug.Log()` for info
- `Debug.LogError()` for errors
- `Debug.LogWarning()` for warnings
- ~100+ log statements across codebase

## Comments

**When to Comment:**
- XML docs for public classes and methods
- Inline comments for complex logic
- ASCII header blocks for major components

**XML Documentation:**
```csharp
/// <summary>
/// Description of class/method purpose.
/// </summary>
```

**File Headers (Network Components):**
```csharp
/***********************************************
 * PURPOSE: What this file does
 * RESPONSIBILITIES: Key responsibilities
 * ARCHITECTURE: How it fits in the system
 * USAGE: How to use it
 ***********************************************/
```

**TODO Comments:**
- Format: `// TODO: description`
- Found in: `NetworkGameBridge.cs`, `NetworkedGameManager.cs`

## Function Design

**Size:**
- No strict limit, but some files are very large (BoardRenderer.cs 900+ lines)

**Parameters:**
- Use descriptive names
- Complex data passed as structs/classes

**Return Values:**
- Explicit returns
- Nullable types where appropriate (Player?)

## Module Design

**Exports:**
- Public for external access
- Private for internal implementation
- No internal visibility modifier used

**Singleton Pattern:**
```csharp
public static ClassName Instance { get; private set; }

private void Awake()
{
    if (Instance != null && Instance != this)
    {
        Destroy(gameObject);
        return;
    }
    Instance = this;
}
```

**Event Pattern:**
```csharp
public event System.Action OnGameStateChanged;
public event System.Action<Player?> OnGameEnded;
```

## Network Code Conventions

**RPC Methods:**
- ServerRpc suffix: `RequestTurnServerRpc()`
- ClientRpc suffix: `OnTurnConfirmedClientRpc()`

**Network Message Types:**
- Prefix with Network: `NetworkHexCoord`, `NetworkMoveData`
- Implement INetworkSerializable

**Serialization:**
- Use NetworkVariable for synced state
- Use RPC for events/actions

---

*Convention analysis: 2026-01-08*
*Update when patterns change*
