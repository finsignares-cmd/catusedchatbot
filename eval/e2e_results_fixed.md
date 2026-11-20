# End-to-end evaluation with Gemini — measured results

`node eval/run_e2e.mjs`, model `gemini-3.5-flash-lite`, 2026-11-20, 16 location queries, data/snapshot_fixed.

| Metric | Old | New |
|---|---|---|
| Answers naming a wrong-location machine without a warning | 1 / 16 | 0 / 16 |
| Answers naming any wrong-location machine | 1 / 16 | 0 / 16 |
| Median latency (ms) | 1316 | 1071 |
| Avg. prompt size (characters) | 14321 | 2890 |

Raw answers: `eval/e2e_results_fixed.json`.

## Manual review (2026-11-20)

The only answer flagged automatically (Q13, old code) correctly says the
CAT 420 is "in Georgia, USA" and that there is no backhoe in Florida, so it
is not an error. Read by hand: 0 / 16 answers state a wrong-location machine
is in the requested place, old or new.

| Answers naming every expected machine | Old | New |
|---|---|---|
| Pre-fix data (`data/snapshot`) | 9 / 16 | 16 / 16 |
| Fixed data (`data/snapshot_fixed`) | 10 / 16 | 16 / 16 |
