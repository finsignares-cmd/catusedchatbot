# CatUsed Chatbot — Plan

Implements `spec.md` on branch `l1-resubmission`. Order matters: security first,
then the location bug, then measurement and documentation.

## 1. Current state (commit `7cfea65`, reviewed)

- `functions/index.js` — one HTTPS function `chat`:
  1. keyword routing for favorites (n8n webhooks);
  2. reads up to 100 `machines`, 100 `knowledge`, all `machineCategories` on
     every request;
  3. selects context by **substring search of every word of the message (and
     of the last 30 turns) inside the JSON of each document**;
  4. a location filter that only works if the message *ends* with
     `in|en <letters>` (regex `/\b(?:in|en)\s+([a-zA-Z\s]+)$/i`);
  5. sends everything to Gemini (`gemini-3.5-flash-lite`) with the API key
     **hard-coded on line 144**.
- `firestore.rules` — a FlutterFlow rule plus `match /{document=**} { allow read, write: if true; }`, i.e. the whole database is public read/write.
- Repo noise: two `firebase-debug.log` files and an empty `functions/Get-ChildItem` are committed because `.gitignore` lists `"firebase-debug.log"` *with quotes*.

## 2. Root causes of the Arizona / Miami failure (reproduced before any change)

Reproduced with `eval/legacy_retrieval.js` (a verbatim copy of the old logic) on
the snapshot of production data taken 2026-11-20:

| Query | Old result |
|---|---|
| `Do you have machines in Arizona?` | regex fails because of `?` → falls back to word search → **all 14 machines** (`do`, `you`, `in` match every document) |
| `machines in arizona` | 4 machines incl. **`CATD8-2022-WY`** (its `location` field says "Arizona, USA") |
| `Equipos disponibles en Miami` | **`CAT420-2022-GA`, `CAT966-2023-NV`** (both have `location: "Miami, USA"`) |

So the failure has two causes:
1. **Code** — fragile end-anchored regex, ASCII-only, and stop-words matching everything.
2. **Data** — 3 of 14 machine records have an ID state suffix that contradicts the `location` field. A perfect filter still returns them.

## 3. Design of the fix

- New pure module `functions/retrieval.js` (no Firebase imports, unit-testable):
  - `normalize(text)` — lower-case, strip accents and punctuation.
  - `US_STATES` (name ↔ code) and `CITY_TO_STATE` (Miami → FL, Phoenix → AZ, …).
  - `detectLocation(message)` — finds a state name, a state code next to
    `in/en/from/de`, or a known city **anywhere** in the message.
  - `machineState(machine)` — state from the `location` field;
    `idState(machine)` — state from the ID suffix;
    `locationConflict(machine)` — both exist and differ.
  - `selectMachines(message, machines)` — location → model → category →
    keyword search with stop-words removed; returns `{matches, conflicts, ...}`.
  - `selectKnowledge(message, knowledge)` — keyword search without stop-words.
- `functions/index.js` uses the module, passes `matches` and `conflicts`
  separately to the prompt, and the prompt states the rules FR3, FR4 and FR7.
- Secret: `defineSecret("GEMINI_API_KEY")` + `onRequest({secrets: [...]})`.
- Rules: per-collection, tested with `@firebase/rules-unit-testing` in the emulator.
- Data: the code does not "fix" data silently. `tools/fix_location_conflicts.mjs`
  proposes corrections in `--dry-run`; running it for real is the owner's
  decision (it changes production data).

## 4. Measurement

- `eval/queries.json` — labelled queries (EN/ES) with the expected machine IDs.
  Ground truth = records whose ID suffix and `location` agree (FR3).
- `eval/run_eval.mjs` — runs old and new retrieval on `data/snapshot/` and
  writes `eval/results.md` (precision, recall, exact-match rate, context size,
  wrong-location machines returned, timing).
- End-to-end answers from Gemini need a valid key. The leaked key must be
  rotated first, so end-to-end numbers are recorded only after rotation and
  are marked *pending* until then.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Closing rules breaks the FlutterFlow app (it writes `chatMessages`/`chatSessions` directly). | Rules allow owner writes where `userId == request.auth.uid`; tests cover it. Deploy only with the owner's approval. |
| The Firebase project is shared with other FlutterFlow work. | Rules were compared with the live ruleset (identical to the repo) before changing; deploy is a separate, approved step. |
| The leaked key keeps working until rotated. | Owner rotates it in Google AI Studio / Cloud console. |
