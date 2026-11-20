# CatUsed Chatbot

Chatbot for buyers of used Caterpillar machines (English and Spanish). It runs
as a Firebase HTTPS function, reads Firestore and answers with Gemini.

Start here:

| What | Where |
|---|---|
| Specification → plan → tasks (written first) | `spec.md`, `plan.md`, `tasks.md` |
| Context for AI coding assistants | `CLAUDE.md` (before/after: `docs/context-artifact-experiment.md`) |
| Where the data comes from | `docs/data-provenance.md` |
| Concrete failures and fixes | `docs/failure-analysis.md` |
| Measured impact (slide 6) | `docs/impact-scorecard.md`, `eval/results.md`, `eval/rules_results.md` |

```bash
cd functions && npm ci && npm test       # 25 unit tests
node eval/run_eval.mjs                   # old vs new retrieval
npm --prefix rules-tests ci && npm --prefix rules-tests run emulate   # 9 rules tests
```

The Gemini key is a Firebase secret: `firebase functions:secrets:set GEMINI_API_KEY`.
