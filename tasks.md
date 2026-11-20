# CatUsed Chatbot — Tasks

Each commit after the spec references the task IDs it closes.

- [x] **T1** Write `spec.md`, `plan.md`, `tasks.md` (this commit).
- [x] **T2** Add `CLAUDE.md` (context artifact for AI coding assistants).
- [x] **T3** Repo hygiene: fix `.gitignore`, untrack `firebase-debug.log` files, `functions/Get-ChildItem` and the root `node_modules/`; remove the unused `catusedchatbot/` init template (not referenced by `firebase.json`).
- [x] **T4** Remove the hard-coded Gemini key; read `GEMINI_API_KEY` with `defineSecret` (NFR1).
- [x] **T5** Replace `allow read, write: if true` with per-collection rules + emulator tests (NFR2).
- [x] **T6** Snapshot of the catalogue (`data/snapshot/`) and verbatim copy of the old retrieval (`eval/legacy_retrieval.js`) to reproduce the failure.
- [x] **T7** `functions/retrieval.js`: location detection anywhere in the message, accent/punctuation-insensitive, city → state, ID/location conflict flag, stop-words (FR2, FR3, FR5, FR6, FR9) + unit tests.
- [x] **T8** Wire `retrieval.js` into `chat`; prompt rules for FR3, FR4, FR7.
- [x] **T9** Labelled query set + `eval/run_eval.mjs`; commit measured `eval/results.md` (NFR3).
- [x] **T10** `tools/fix_location_conflicts.mjs` (dry-run by default) for the 3 inconsistent records.
- [x] **T11** `docs/data-provenance.md` (NFR4).
- [ ] **T12** `docs/failure-analysis.md` with concrete failures from this data (replaces the generic analysis of slides 7 and 10).
- [ ] **T13** `docs/impact-scorecard.md` with measured numbers (slide 6) and `docs/slides_6_7_10.md` with the replacement slide text.
- [ ] **T14** CLAUDE.md before/after example captured from a real run.

Owner-only steps (need Francisco's approval, not done by the assistant):

- [ ] **O1** Rotate the leaked Gemini key and store the new one: `firebase functions:secrets:set GEMINI_API_KEY`.
- [ ] **O2** Deploy rules and function: `firebase deploy --only firestore:rules,functions`.
- [ ] **O3** Decide the true location of the 3 inconsistent machines and run `tools/fix_location_conflicts.mjs --apply`.
- [ ] **O4** Update slides 6, 7 and 10; push the branch; resubmit the form.
