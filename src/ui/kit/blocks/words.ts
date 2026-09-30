// WORDS — every block's text is a `words` prop with English defaults (the …Words objects),
// so a game can pass its own from content/text/en.json and translate later.
//   <Pause words={text.pause} />      → only the words you pass change; the rest stay English
// fill('Round {n} of {total}', { n: 2, total: 5 }) → 'Round 2 of 5'
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
