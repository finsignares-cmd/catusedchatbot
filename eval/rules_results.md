# Firestore rules — measured results (T5)

Command: `npm --prefix rules-tests run emulate` (Firestore emulator, project
`demo-catused`, no production access). Run on 2026-11-20.

| Rules file | Tests passed | Tests failed |
|---|---|---|
| Original (`7cfea65`, `allow read, write: if true`) | 1 / 9 | 8 / 9 (anonymous read/write of every collection, cross-user chat access) |
| New (`firestore.rules` on this branch) | 9 / 9 | 0 / 9 |

The live ruleset of the Firebase project was read (read-only, Rules API) on
2026-11-20 and is identical to the original file: the database is currently
open to anyone until the new rules are deployed (tasks.md O2).

## Deployment note (2026-11-20)

The first version of the new rules was deployed at 15:18 UTC and broke the
FlutterFlow app's chat for about 3 minutes. The app (code exported from
FlutterFlow, `chat_bot_widget.dart`) reads messages with `where sessionId ==`
only, and stores the bot reply itself with `userId: "AI"`. Both were
rejected. The rules now check ownership through the chat session. Two tests
reproduce the app's exact query and write. The corrected rules were deployed
at 15:21 UTC (ruleset `13dab113…`). Anonymous access is still refused
(HTTP 403, checked live).
