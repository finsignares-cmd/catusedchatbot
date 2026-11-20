# Firestore rules — measured results (T5)

Command: `npm --prefix rules-tests run emulate` (Firestore emulator, project
`demo-catused`, no production access). Run on 2026-11-20.

| Rules file | Tests passed | Tests failed |
|---|---|---|
| Original (`7cfea65`, `allow read, write: if true`) | 1 / 8 | 7 / 8 (anonymous read/write of every collection, cross-user chat access) |
| New (`firestore.rules` on this branch) | 8 / 8 | 0 / 8 |

The live ruleset of the Firebase project was read (read-only, Rules API) on
2026-11-20 and is identical to the original file: the database is currently
open to anyone until the new rules are deployed (tasks.md O2).
