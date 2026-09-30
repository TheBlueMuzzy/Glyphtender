# Glyphtender — Bugs
Open: 1 (P0 0 · P1 0 · P2 0 · P3 1)
## Open
### B001 · P3 · open · found 2026-09-30 in F05 · v0.0.0 · word list data
ZYGOTES isn't a word; "ZYGOTESAA" is
Steps: play ZYGOTES · Expected: scores · Actual: not in the list; the list has `ZYGOTESAA,0.00` instead.
Cause: the original's "+218 missing words" commit (8522a373, 2025-12-22) appended "AA…" to a file whose last line (ZYGOTES) had no newline, gluing them together. AA itself is also in the list (AA,4.01), so only ZYGOTES is lost.
Fix waiting on Muzzy (precious data — never changed without his OK): split the line into `ZYGOTES` (Zipf from the original 5353eaca list, or 0.00) and drop the duplicate AA. Related question: the list ends with 7 later additions — AIDS, AWOL, CHINA, FRENCH, JAPAN, MOROCCO, ROMAN (proper nouns/abbreviations the cleanup removed elsewhere) — keep?
## Fixed (newest first)
