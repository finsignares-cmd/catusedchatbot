# Catalogue snapshot

Read-only export of the Firestore collections the chatbot reads, taken
2026-11-20 from the project in `.firebaserc` (Firestore REST API, `GET`
only). `_id` = document id, `_createTime` = Firestore creation time; the
other fields are exactly as stored.

| File | Docs |
|---|---|
| `machines.json` | 14 |
| `knowledge.json` | 30 |
| `machineCategories.json` | 7 |

User data (`users`, `chatSessions`, `chatMessages`) is deliberately **not**
exported. Used by `eval/run_eval.mjs` so "before" and "after" are measured on
the same data. Provenance: `docs/data-provenance.md`.
