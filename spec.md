# CatUsed Chatbot — Specification

> **Status and honesty note.** The first version of this chatbot (commit `7cfea65`)
> was built as a prototype *without* a written specification. This document was
> written on 2026-11-20, after that prototype was reviewed ("Not Yet Certified",
> L1 capstone). It is the specification that governs every change on the branch
> `l1-resubmission`: the spec, plan and tasks are committed first, and each
> later commit implements a task listed in `tasks.md`. No commit dates were
> altered.

## 1. Problem

CatUsed sells used Caterpillar machines located in different US states. Buyers
ask questions in English or Spanish such as *"Do you have excavators in
Arizona?"*, *"specs of the CAT 349"* or *"add it to my favorites"*. Answering
them by hand is slow, and a generic LLM invents machines, prices and locations.

## 2. Users

| User | Need |
|---|---|
| Buyer (web/mobile app built in FlutterFlow, signed in with Firebase Auth) | Find machines by location, model, category and specs; keep a favorites list. |
| CatUsed staff | Keep the catalogue (`machines`, `knowledge`, `machineCategories`) in Firestore. |

## 3. Scope

In scope: the HTTPS function `chat` (Firebase Functions, Node 22), its retrieval
of Firestore data, the Gemini prompt, the favorites tools (n8n webhooks) and the
Firestore security rules.

Out of scope: the FlutterFlow UI, the n8n workflows themselves, pricing (the
catalogue has no prices).

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR1 | The answer is in the language of the user message (English or Spanish). |
| FR2 | **Location queries.** When the message names a US state (full name or 2-letter code) or a known city, only machines whose `location` is that place (city, or the city's state) are offered as "in <place>". Punctuation (`?`, `¿`, `!`, `.`), accents and the position of the place in the sentence must not change the result. |
| FR3 | **Inconsistent records.** A machine whose ID suffix (e.g. `-WY`) names a different state than its `location` field must not be presented as a confirmed match for either state. The answer may mention it, flagged as "location to be confirmed". |
| FR4 | **No location match.** If no machine is in the requested place, the bot says so and may suggest machines in other states, labelled as such. It never relabels a machine's location. |
| FR5 | **Model queries.** "CAT 349", "cat349", "349" select that model's records. |
| FR6 | **Category queries.** "excavators/excavadoras", "dozers/topadoras", "wheel loaders/cargadores", "motor graders/motoniveladoras", "backhoe" select that category. |
| FR7 | Machine data in an answer (year, hours, location, specs) comes only from Firestore. The prompt forbids inventing machines, prices or locations. |
| FR8 | Favorites: add / list / remove / clear (n8n tools) for the signed-in user, in English and Spanish, using the machine named in the message or the last one of the session. If n8n is unreachable the bot says so; the model never claims a favorite operation. |
| FR9 | Common words ("do", "you", "have", "in", "the", "de", "en", "hay"…) never select machines or knowledge articles by themselves. |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR1 | **No secrets in source code.** The Gemini API key is read from Firebase Secret Manager (`GEMINI_API_KEY`), never committed. The key that was committed in `7cfea65` must be rotated (it stays in git history). |
| NFR2 | **Least-privilege Firestore rules.** No `allow read, write: if true`. Catalogue: read for signed-in users, no client writes. `users/{uid}`: only its owner. `chatSessions` and `chatMessages`: only documents whose `userId` is the caller's uid. The FlutterFlow editor account keeps its access (needed by the FlutterFlow schema tool). The Cloud Function uses the Admin SDK and is not affected by rules. |
| NFR3 | **Measurable quality.** A labelled query set and an offline evaluation script report retrieval precision/recall and context size for the old and new logic on the same data snapshot. |
| NFR4 | **Data provenance documented** for every Firestore collection the bot reads (`docs/data-provenance.md`). |
| NFR5 | **No noise in the repo:** no debug logs, no stray files; `.gitignore` must work. |

## 6. Acceptance criteria

1. `grep -rn "AIza" functions/` finds nothing; the function reads `GEMINI_API_KEY` from a secret.
2. `firestore.rules` has no `if true`; the rules tests pass in the Firestore emulator.
3. On the data snapshot `data/snapshot/` (exported 2026-11-20):
   - "Do you have machines in Arizona?" returns only machines whose ID and location both say Arizona (`CAT349-2022-AZ`, `CAT950-2022-AZ`, `CAT340-2022-AZ`); `CATD8-2022-WY` is reported as an inconsistent record, not as an Arizona match.
   - Miami queries never present `CAT420-2022-GA` or `CAT966-2023-NV` as machines in Miami.
   - Retrieval precision on the labelled set is ≥ 0.95 and recall ≥ 0.95 (old logic is measured and reported, whatever it is).
4. Unit tests (`npm test` in `functions/`) pass.
5. `docs/data-provenance.md`, `docs/failure-analysis.md` and `docs/impact-scorecard.md` exist. Every number in them is either measured (with the command that produced it) or explicitly marked *pending*.
