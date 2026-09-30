// Placeholder home page until the real menus arrive (F14). Links to the current prototype.
export default function App() {
  return (
    <main className="placeholder">
      <h1>Glyphtender</h1>
      <p>The best speller doesn’t always win.</p>
      <a href={`${import.meta.env.BASE_URL}sketches/move-cast/`}>Prototype: move → cast → undo</a>
    </main>
  )
}
