# Phase 1: Online Multiplayer Polish - Context

**Gathered:** 2026-01-08
**Status:** Ready for planning

<vision>
## How This Should Work

After an online game ends, players see a "Rematch?" button. When someone clicks it, the button toggles to green and shows "Rematch! XXs" with a countdown (30s, tunable). The timer only starts when the first person clicks - if no one clicks, players can sit there forever looking at the board.

Other players have until the timer expires to also click rematch. Their avatars (or temporarily, their names in the stats column) show a checkmark when they've confirmed, an X when they've declined or left. Players can toggle their rematch on/off - changing their mind is allowed.

A player declines by:
- Clicking the explicit "Decline" button
- Leaving to main menu
- Letting the timer expire without clicking

Opening options or viewing the board are NOT decline triggers - those are just viewing actions.

When the timer ends, confirmed players start a new game together. The game size is flexible - a 4p game can become 3p or 2p if some players decline. Minimum is 2 players; if only 1 person clicks rematch, they're booted to main menu.

The experience should feel seamless - you finish a game, tap rematch, see your friends tap rematch, and you're right back into another game without navigating menus.

</vision>

<essential>
## What Must Be Nailed

- **The toggle button experience** - "Rematch?" to "Rematch! XXs" with visual feedback that feels good to tap
- **Clear player status** - Everyone can see who's confirmed, who's still deciding, who's declined
- **Flexible player count** - Rematch works even if some players drop out, as long as 2+ remain

</essential>

<boundaries>
## What's Out of Scope

- AI replacement voting (when someone disconnects mid-game) - defer to later
- Forfeit penalties/tracking - not yet
- Connection monitoring/heartbeat - defer to later phase
- Mid-game disconnect handling - defer entirely for Phase 1
- The 30s forfeit grace period idea - track for when forfeit system is built

</boundaries>

<specifics>
## Specific Ideas

- Timer is 30 seconds but should be tunable after testing (maybe 15s feels better)
- Temporary visual: X/Check above player names in stats column until avatar system exists
- If someone leaves the app entirely, they get an X on their avatar/name
- People who decline quickly get immediate X so others know not to wait

</specifics>

<notes>
## Additional Context

**Deferred ideas to track (for future phases):**
- When someone disconnects or forfeits mid-game, remaining players could vote to replace with AI (after ~1 minute delay)
- New matches could have a 30s forfeit grace period - if someone realizes they joined by mistake, they can leave without penalty

**Phase scope change:**
Original roadmap had forfeit/disconnect handling in Phase 1. User decided to focus purely on rematch flow - the others are deferred. This keeps the phase tight and deliverable.

</notes>

---

*Phase: 01-online-multiplayer-polish*
*Context gathered: 2026-01-08*
