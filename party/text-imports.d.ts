// esbuild (which wrangler uses — wrangler.json "rules": Text) reads .txt files as plain text — this tells TypeScript the same.
declare module '*.txt' {
  const text: string
  export default text
}
