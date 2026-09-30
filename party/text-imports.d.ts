// esbuild (which PartyKit uses) reads .txt files as plain text — this tells TypeScript the same.
declare module '*.txt' {
  const text: string
  export default text
}
