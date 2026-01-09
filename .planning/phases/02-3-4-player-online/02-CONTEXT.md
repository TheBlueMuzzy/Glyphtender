# Phase 2: 3-4 Player Online - Context

**Gathered:** 2026-01-09
**Status:** Ready for planning

<vision>
## How This Should Work

Host creates a room and picks the player count (3 or 4). They share the room code with friends. Others join using the code and fill slots. The lobby shows slots filling up visually (1/3, 2/3, 3/3). When all slots are full, the game auto-starts.

The experience should feel just like local 3-4 player, but over the network. Same draft flow, same turn order, same gameplay - just remote.

</vision>

<essential>
## What Must Be Nailed

- **Reliability** - Games connect and sync properly. No desyncs, no weird bugs. If 3-4 players join and play a full game, it just works.

</essential>

<boundaries>
## What's Out of Scope

- Spectator mode - everyone in the room is a player
- Mid-game join/leave handling - if someone disconnects, game ends
- Player customization - players get assigned to slots (Yellow, Blue, Purple, Pink) automatically
- Flexible player counts mid-game - once room is set for 3 or 4, that's fixed

</boundaries>

<specifics>
## Specific Ideas

No specific requirements - open to whatever approach makes sense. Just extend the existing 1v1 online flow to support more players.

</specifics>

<notes>
## Additional Context

Priority is making it work reliably. The 1v1 online flow is solid now (v786) - this phase extends that foundation to more players. Keep the same patterns where possible.

Local 3-4 player already works. Online 1v1 already works. This phase bridges them.

</notes>

---

*Phase: 02-3-4-player-online*
*Context gathered: 2026-01-09*
