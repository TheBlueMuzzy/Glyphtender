# Testing Patterns

**Analysis Date:** 2026-01-08

## Test Framework

**Runner:**
- Not configured (no test framework set up)
- Unity Test Framework available but not used

**Assertion Library:**
- Not applicable (no tests)

**Run Commands:**
```bash
# No test commands configured
# Manual testing via Unity Editor and builds
```

## Test File Organization

**Location:**
- No test files present in `Assets/Scripts/`
- No `Tests/` directory
- No `*.asmdef` files for test assemblies

**Naming:**
- Not applicable

**Structure:**
- Not applicable

## Current Testing Approach

**Manual Testing:**
- Play testing via Unity Editor
- Build testing on Android/PC
- Cross-network testing for multiplayer

**Version Verification:**
- BUILD_VERSION in `MainMenuScreen.cs:129`
- Increment before testing to verify code compiled
- Displayed in red text at main menu top

**Network Testing:**
- Same-WiFi testing
- Cross-network testing (documented in CLAUDE.md)
- Manual room code join/create flows

## Test Coverage

**Requirements:**
- No formal coverage requirements
- No coverage tracking

**Gaps (Critical):**
- GameRules - Turn validation, execution
- WordScorer - Dictionary, word detection
- TangleChecker - Tangle conditions
- AIBrain - Move selection logic
- Network sync - Message handling

## Testability Design

**Core Layer (Testable):**
- Pure C# with no Unity dependencies
- GameState.Clone() enables simulation
- Static methods in GameRules
- Can be unit tested with any .NET test framework

**Unity Layer (Harder to Test):**
- MonoBehaviour dependencies
- Singleton pattern
- Coroutine-based animations
- Would require Unity Test Framework

## Test Types

**Unit Tests:**
- Not implemented
- Core layer is ready for unit tests
- Would use NUnit (Unity standard)

**Integration Tests:**
- Not implemented
- Network flow would need mocking

**E2E Tests:**
- Manual only
- Full game playthrough
- Online multiplayer flows

## Recommended Test Setup

**For Core Layer:**
```csharp
// Example test structure (not yet implemented)
[TestFixture]
public class GameRulesTests
{
    [Test]
    public void ExecuteTurn_ValidMove_UpdatesGameState()
    {
        var state = GameRules.CreateNewGame(...);
        var newState = GameRules.ExecuteTurn(state, move, cast);
        Assert.AreEqual(expectedScore, newState.Scores[Player.Yellow]);
    }
}
```

**Assembly Definition:**
- Would need `Glyphtender.Tests.asmdef`
- Reference `Glyphtender.Core` assembly
- Editor-only platform

## Testing Documentation

**CLAUDE.md Documents:**
- Version tracking workflow
- Bug prevention protocol
- Common pitfalls (Netcode timing, ghost objects)

**HANDOFF.md Documents:**
- Turn flow for manual testing
- Draft flow for manual testing
- Network sync points to verify

---

*Testing analysis: 2026-01-08*
*Update when test patterns change*
