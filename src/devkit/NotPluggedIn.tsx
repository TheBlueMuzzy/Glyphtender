// Shown by the tools that need the game (Snapshots, Bug capture) when it hasn't registered its adapter.

export function NotPluggedIn() {
  return (
    <p className="devkit-not-plugged">
      This game isn't plugged into the Dev Kit yet — add <code>registerDevKitGame(…)</code> to
      src/devkit-game/tabs.ts (see the Dev Kit README). Then Snapshots and Bug capture can see the game.
    </p>
  )
}
