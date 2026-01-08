# Technology Stack

**Analysis Date:** 2026-01-08

## Languages

**Primary:**
- C# 9.0 - All application code (`Unity/GlyphtenderUnity/Assets/Scripts/`)

**Secondary:**
- None (pure C# Unity project)

## Runtime

**Environment:**
- Unity Engine 2022.3.62f3 LTS (`Unity/GlyphtenderUnity/ProjectSettings/ProjectVersion.txt`)
- .NET Framework 4.7.1 with .NET Standard 2.1 support

**Package Manager:**
- Unity Package Manager (UPM)
- Manifest: `Unity/GlyphtenderUnity/Packages/manifest.json`

## Frameworks

**Core:**
- Unity Engine 2022.3 LTS - Game engine
- Unity Netcode for GameObjects 1.15.0 - Multiplayer networking (`com.unity.netcode.gameobjects`)
- Unity Transport 1.5.0 - UDP networking layer (`com.unity.transport`)

**UI:**
- TextMesh Pro 3.0.7 - Text rendering (`com.unity.textmeshpro`)
- Unity UGUI 1.0.0 - 3D UI elements (`com.unity.ugui`)

**Testing:**
- Not configured (manual testing only)

**Build/Dev:**
- Visual Studio Code Extension 1.2.5 (`com.unity.ide.vscode`)
- JetBrains Rider Extension 3.0.36 (`com.unity.ide.rider`)

## Key Dependencies

**Critical:**
- Unity Gaming Services Authentication 3.5.2 - Anonymous player IDs (`com.unity.services.authentication`)
- Unity Gaming Services Lobby 1.3.0 - Room code matchmaking (`com.unity.services.lobby`)
- Unity Gaming Services Relay 1.2.0 - NAT traversal (`com.unity.services.relay`)
- Unity Gaming Services QoS 1.3.2 - Region selection (`com.unity.services.qos`)

**Infrastructure:**
- Newtonsoft.Json 3.2.1 - JSON serialization (`com.unity.nuget.newtonsoft-json`)
- Unity Collections 1.2.4 - High-performance data structures (`com.unity.collections`)
- Unity Mathematics 1.2.6 - Vector/math operations (`com.unity.mathematics`)

## Configuration

**Environment:**
- No .env files - all configuration via Unity Editor settings
- Unity Gaming Services configured via Unity Dashboard (project ID, environment)

**Build:**
- `Unity/GlyphtenderUnity/Assembly-CSharp.csproj` - Main project
- `Unity/GlyphtenderUnity/Glyphtender.Unity.Network.csproj` - Network assembly
- `Unity/GlyphtenderUnity/ProjectSettings/` - Unity project settings

## Platform Requirements

**Development:**
- Windows (any platform with Unity Editor)
- Unity Hub with Unity 2022.3 LTS

**Production:**
- Android/iOS - Primary mobile targets
- Windows Standalone - PC builds
- WebGL - Itch.io deployment

**Version Tracking:**
- Custom BUILD_VERSION in `MainMenuScreen.cs:129`
- Displayed in red text at main menu top
- Used to verify Unity has recompiled code changes

---

*Stack analysis: 2026-01-08*
*Update after major dependency changes*
