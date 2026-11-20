# Impact scorecard (slide 6) — measured numbers

Every number is measured, with the command that reproduces it. Rows that
could not be measured yet say **pending** and why. Before = commit `7cfea65`
(original submission). After = branch `l1-resubmission`.

## Retrieval quality — `node eval/run_eval.mjs` (24 labelled queries, EN+ES, data snapshot 2026-11-20)

| Metric | Before | After |
|---|---|---|
| Precision of machines given to the model | 17.5 % | 96.0 % |
| Recall | 97.9 % | 100.0 % |
| Questions with exactly the right machines | 4 / 24 | 23 / 24 |
| Location questions offering a machine from another place | 13 / 16 | 0 / 16 |
| Wrong-location machines offered (total over 16 questions) | 129 | 0 |
| Machines in context per question (avg.) | 11.2 | 2.1 |
| Knowledge docs in context per question (avg.) | 30.0 | 1.2 |
| Context size per question (avg. characters) | 13,975 | 1,157 (−92 %) |
| Retrieval CPU time per question (avg.) | 0.07 ms | 0.22 ms (negligible next to the LLM call) |
| Answer language matches the question (`node eval/run_lang.mjs`) | 23 / 24 | 24 / 24 |

> **Caveat.** The labels and the ground-truth rule (FR3: ID suffix and
> location must agree) were written by the same author who wrote the fix,
> and the new code implements that rule. These numbers therefore measure
> conformance to the specification on this data, not independent accuracy.
> The old logic is measured against the same rule.

## Security — `npm --prefix rules-tests run emulate` and `git grep`

| Metric | Before | After |
|---|---|---|
| Firestore rule tests passed (9 tests: anonymous access, cross-user chat access, catalogue writes, unknown collections, the app's real queries) | 1 / 9 | 9 / 9 (deployed 2026-11-20) |
| API keys in source code | 1 (Gemini key, `functions/index.js:144`) | 0 (Secret Manager `GEMINI_API_KEY`) |
| Debug logs and `node_modules` tracked in git | 2 logs + 6,314 dependency files | 0 |

## Data quality — `node functions/tools/fix_location_conflicts.mjs` and `docs/data-provenance.md`

| Metric | Value (production data, 2026-11-20) |
|---|---|
| Machines whose ID contradicts their location | 3 / 14 (21 %) |
| Machines with a non-URL `sourceUrl` | 3 / 14 (corrected 2026-11-20) |
| Other record defects listed (stray quote, location used as description) | 2 (both corrected 2026-11-20; live check: 0 defects left) |
| Detected and flagged by the bot automatically | 3 / 3 contradictions |
| Corrected in production | 3 / 3 (2026-11-20; live dry-run now finds 0 conflicts) |

## Engineering process

| Metric | Before | After |
|---|---|---|
| Spec / plan / tasks in git before the code changes | No | Yes (first commit of the branch, `T1`) |
| Automated tests | 0 | 14 unit tests + 9 rules tests, all passing |
| Commits linked to a task ID | 0 / 1 | every commit on the branch |

## End-to-end answers from Gemini — `node eval/run_e2e.mjs` (16 location questions, `gemini-3.5-flash-lite`, 2026-11-20)

| Metric | Before | After |
|---|---|---|
| Answers stating a wrong-location machine is in the requested place (read by hand) | 8 / 16 | 0 / 16 |
| Answers mentioning a contradictory record with "location must be confirmed" | 0 / 16 | 10 / 16 |
| Median latency of the model call | 1,230 ms | 1,058 ms |
| Prompt size sent to Gemini (avg. characters) | 14,594 | 3,109 (−79 %) |

Details and raw answers: `eval/e2e_results.md`, `eval/e2e_results.json`.

## Code fix vs data fix — the same measurements on the corrected data (`--data fixed`)

`data/snapshot_fixed/` was exported after the owner-approved data fixes
(2026-11-20). Labels change only where the right answer changed (Wyoming,
Georgia, Nevada; `expectedFixed` in `eval/queries.json`).

| Location questions offering a machine from another place | Old code | New code |
|---|---|---|
| Pre-fix data | 13 / 16 | 0 / 16 |
| Fixed data | 10 / 16 | 0 / 16 |

| Gemini answers naming every right machine (16 location questions) | Old code | New code |
|---|---|---|
| Pre-fix data | 9 / 16 | 16 / 16 |
| Fixed data | 10 / 16 | 16 / 16 |

| Gemini answers stating a wrong-location machine is there (read by hand) | Old code | New code |
|---|---|---|
| Pre-fix data | 8 / 16 | 0 / 16 |
| Fixed data | 0 / 16 | 0 / 16 |

Reading: fixing the data removes the false "it's in Arizona" claims, but
with the old code 10 of 16 location questions still flood the model with
machines from other states (the `?` and empty-term bugs), and Gemini still
leaves out machines in 6 of 16 answers. Both fixes were needed. Retrieval on
fixed data, new code: precision 96.2 %, 23 / 24 exact (`eval/results_fixed.md`).

No business numbers (sales, time saved, user satisfaction) are claimed:
there are no real users or sales data for this demo.
