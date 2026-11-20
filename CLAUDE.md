# CLAUDE.md — context for AI coding assistants (Claude Code, Copilot, Gemini CLI)

Read `spec.md`, `plan.md` and `tasks.md` before changing code. Every change
must map to a task ID in `tasks.md`; tick the box in the same commit.

## What this is
CatUsed chatbot: one Firebase HTTPS function `chat` (`functions/index.js`,
Node 20, ES modules) that answers buyers of used Caterpillar machines in
English or Spanish using Firestore data + Gemini. Favorites go through n8n
webhooks. The UI is a FlutterFlow app (not in this repo).
Firebase project: see `.firebaserc`.

## Data (Firestore, read by the function)
- `machines` — one doc per machine: `machineId` (e.g. `CAT349-2022-AZ`, suffix =
  US state code), `model`, `category`, `year`, `hours`, `location`
  (`"<State or City>, USA"`), `specifications` (array), `description`.
- `knowledge` — short articles `{title, content, category, sourceUrl}` (EN + ES).
- `machineCategories` — `{name, description}`.
- `chatSessions/{sessionId}`, `chatMessages` — written by the FlutterFlow app
  (`userId` = Firebase Auth uid) and by the function (last machine of a session).
- Provenance and known data defects: `docs/data-provenance.md`.

## Rules that are easy to get wrong
1. **Location filtering uses only the `location` field**, normalized
   (`functions/retrieval.js`). Never `JSON.stringify(doc).includes(word)` — words
   like "in", "do", "you" match every document.
2. A machine whose ID suffix and `location` disagree (e.g. `CATD8-2022-WY` with
   `location: "Arizona, USA"`) is a **conflict**: never present it as a confirmed
   match for a place; mention it as "location to be confirmed".
3. Questions end with `?` and Spanish ones start with `¿` and use accents
   (`¿Qué excavadoras hay en Arizona?`): normalize before matching.
4. Never invent machines, prices or locations. The catalogue has no prices.
5. Answer in the language of the user message.

## Security
- No API keys in code. Gemini key = secret `GEMINI_API_KEY`
  (`defineSecret`, `onRequest({secrets})`). Locally: `functions/.secret.local`
  (git-ignored). Never print or log a key.
- `firestore.rules`: never `allow read, write: if true`. Run the rules tests
  after any change.

## Commands
```bash
cd functions
npm test                      # unit tests (node:test) for retrieval.js
npm run lint
node ../eval/run_eval.mjs     # old vs new retrieval on data/snapshot → eval/results.md
npm run test:rules            # Firestore rules tests (needs the emulator / Java)
```
Deploying (`firebase deploy`) and changing production data are done only by
the owner.

## Style
Google ESLint config (2-space indent, double quotes, trailing commas, JSDoc on
exported functions). Keep `retrieval.js` free of Firebase imports so it stays
unit-testable.
