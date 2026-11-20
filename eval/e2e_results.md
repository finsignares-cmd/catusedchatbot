# End-to-end evaluation with Gemini — measured results

`node eval/run_e2e.mjs`, model `gemini-3.5-flash-lite`, 2026-11-20, 16 location queries, data/snapshot.

| Metric | Old | New |
|---|---|---|
| Answers naming a wrong-location machine without a warning | 8 / 16 | 0 / 16 |
| Answers naming any wrong-location machine | 8 / 16 | 10 / 16 |
| Median latency (ms) | 1230 | 1058 |
| Avg. prompt size (characters) | 14594 | 3109 |

Raw answers: `eval/e2e_results.json`.

## Manual review of the 32 answers (2026-11-20)

The automatic "warning" check is a keyword regex, so every answer that names
a wrong-location machine was also read by hand:

| | Old | New |
|---|---|---|
| Answers that state a wrong-location machine **is in** the requested place | **8 / 16** (Q01, Q02, Q03, Q04, Q07, Q08, Q12, Q13) | **0 / 16** |
| Answers that mention a contradictory record **with** "location must be confirmed" | 0 / 16 | 10 / 16 |

Example, Q01 `Do you have machines in Arizona?`:

- Old: "Yes, we currently have several machines located in Arizona: … **CAT D8 Dozer** (2022) - Located in Arizona (`CATD8-2022-WY`)"
- New: "… CAT D8, CATD8-2022-WY, 2022, 3600 hours, Arizona, USA (Location must be confirmed with CatUsed staff, ID/location mismatch …)"

Still imperfect: Q13 new says "There are no confirmed machines in Florida"
when it means "no confirmed backhoe" (CAT336-2023-FL is in Florida). The
facts in the answer are right, but the wording is too broad.
