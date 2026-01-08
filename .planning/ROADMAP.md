# Roadmap: Glyphtender

## Overview

Complete the online multiplayer experience from working 1v1 to polished 2-4 player support, then improve menus and animations, add user preferences, and clean up code for external review. This milestone delivers a complete, polished multiplayer word-strategy game.

## Domain Expertise

None (no domain skills installed)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Online Multiplayer Polish** - Fix rematch flow, forfeit/disconnect handling
- [ ] **Phase 2: 3-4 Player Online** - Extend network architecture for multiplayer
- [ ] **Phase 3: Menu System Rework** - Layout improvements, flow reorganization
- [ ] **Phase 4: Animation System** - Rework animations, AI human-like timing
- [ ] **Phase 5: User Preferences** - Settings, responsive design, customization
- [ ] **Phase 6: Code Quality** - Refactor, cleanup for engineer audit

## Phase Details

### Phase 1: Online Multiplayer Polish
**Goal**: Seamless rematch flow for online games
**Depends on**: Nothing (builds on working v0.4.1)
**Research**: Unlikely (existing network patterns)
**Plans**: TBD

Key work:
- Rematch button with toggle state ("Rematch?" → "Rematch! XXs")
- Timer starts when first player clicks (30s, tunable)
- Decline via button, leaving, or timeout
- Visual feedback showing player status (confirmed/declined)
- Flexible player count (4p can become 3p or 2p rematch)

Deferred to later phases:
- Forfeit handling
- Connection monitoring/heartbeat
- Mid-game disconnect handling

### Phase 2: 3-4 Player Online
**Goal**: Extend online multiplayer to support 3 and 4 players
**Depends on**: Phase 1
**Research**: Likely (multi-player lobby patterns)
**Research topics**: Unity Lobby 3-4 player setup, network message broadcasting to multiple clients, turn order management for 3-4 players
**Plans**: TBD

Key work:
- Extend lobby to support 3-4 players
- Update network messages for multi-client broadcast
- Handle draft order for 3-4 players online
- Test cross-network with 3-4 players

### Phase 3: Menu System Rework
**Goal**: Intuitive, well-organized menu flow with fixed 3D UI camera issues
**Depends on**: Phase 1 (rematch flow needs menu integration)
**Research**: Unlikely (internal 3D UI patterns)
**Plans**: TBD

Key work:
- Reorganize menu flow (UX and structure)
- Fix 3D UI camera switching weirdness
- Improve menu layouts
- Word-based room codes (if secure)

### Phase 4: Animation System
**Goal**: Polished, consistent animations where AI plays like humans
**Depends on**: Phase 2 (animations must work for all player counts)
**Research**: Unlikely (existing Unity animation patterns)
**Plans**: TBD

Key work:
- Rework animation system architecture
- AI animates like human players (not instant)
- Consistent timing across local and online play
- Extract hard-coded animation timing to config

### Phase 5: User Preferences
**Goal**: Player customization options and responsive design
**Depends on**: Phase 3 (settings integrated into new menu flow)
**Research**: Unlikely (PlayerPrefs, existing patterns)
**Plans**: TBD

Key work:
- Hand organization features
- Color preference options
- Randomized starting player option
- Responsive design for different screen sizes

### Phase 6: Code Quality
**Goal**: Clean, maintainable code ready for external engineer review
**Depends on**: All previous phases (refactor after features stable)
**Research**: Unlikely (internal refactoring)
**Plans**: TBD

Key work:
- Refactor BoardRenderer (900+ lines god class)
- Split into BoardHexRenderer, TileRenderer, GlyphlingRenderer, HighlightManager
- Fix static input state for future extensibility
- General code cleanup and documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Online Multiplayer Polish | 0/TBD | Not started | - |
| 2. 3-4 Player Online | 0/TBD | Not started | - |
| 3. Menu System Rework | 0/TBD | Not started | - |
| 4. Animation System | 0/TBD | Not started | - |
| 5. User Preferences | 0/TBD | Not started | - |
| 6. Code Quality | 0/TBD | Not started | - |
