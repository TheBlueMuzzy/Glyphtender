// The Dev Kit's search box: pinned under the tabs row, filters every settings tab live as you type
// (DevKit.tsx does the filtering through each tab's countMatches + query). ✕ or Esc clears it.
type Props = {
  value: string
  onChange: (value: string) => void
  found: number | null // how many settings match (null = not searching)
}

export function SearchBar({ value, onChange, found }: Props) {
  return (
    <div className="dk-search" role="search">
      <div className="dk-search-box">
        <span className="dk-search-icon" aria-hidden="true">⌕</span>
        <input
          className="dk-search-input"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search settings…"
          aria-label="Search settings"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {value && (
          <button type="button" className="dk-search-clear" onClick={() => onChange('')} aria-label="Clear the search" title="Clear (Esc)">
            ✕
          </button>
        )}
      </div>
      {found !== null && (
        <span className="dk-search-count" role="status">
          {found === 0 ? 'none' : found === 1 ? '1 setting' : `${found} settings`}
        </span>
      )}
    </div>
  )
}
