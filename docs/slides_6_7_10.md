# Replacement text for slides 6, 7 and 10

Copy into the deck. All numbers come from `docs/impact-scorecard.md`.

---

## Slide 6 — Impact Scorecard (measured, not estimated)

**Title:** Impact Scorecard: measured on 24 labelled questions and real catalogue data

| | Before | After |
|---|---|---|
| Right machines given to the AI (precision) | 17.5 % | 96.0 % |
| Questions answered with exactly the right machines | 4 / 24 | 23 / 24 |
| Location questions showing a machine from another state | 13 / 16 | 0 / 16 |
| Context sent to the AI per question | 13,975 chars | 1,157 chars (−92 %) |
| Gemini answers saying a machine is in a state where it is not | 8 / 16 | 0 / 16 |
| Median answer time (Gemini call) | 1.23 s | 1.06 s |
| Security rule tests passed | 1 / 9 | 9 / 9 |
| API keys in code | 1 | 0 |

Footer: *Source: `eval/results.md`, `eval/rules_results.md` (repo branch
l1-resubmission, 2026-11-20); Gemini answers: `eval/e2e_results.md`.*

---

## Slide 7 — What failed, concretely

**Title:** Two real failures from our data

1. **"Machines in Arizona" → CATD8-2022-WY.** The record says
   `location: "Arizona, USA"` but its ID says Wyoming. The bot trusted a
   text search over the whole record and never compared the two.
2. **"Equipos disponibles en Miami" → CAT420-2022-GA and CAT966-2023-NV.**
   Both say "Miami, USA" while their IDs say Georgia and Nevada. The real
   Florida machine (CAT336-2023-FL) was never found because "Miami" is a
   city and the data uses states.
3. **"Do you have machines in Arizona?" → all 14 machines.** The `?`
   broke the location regex, and an empty search term matched every
   document.

Root cause: **3 of 14 records (21 %) have contradictory locations**, and the
code had no check for it.

---

## Slide 10 — Lessons and fixes

**Title:** What we changed and what we learned

- **Data before prompts.** We wrote a data-provenance note. The catalogue
  is a hand-typed demo, and 3 records contradict themselves. The bot now
  flags them ("location to be confirmed") instead of guessing.
- **Match on the right field.** Location is now matched only against the
  `location` field, normalized (accents, `¿?`), with Miami → Florida. Result:
  0 of 16 location questions show a wrong-state machine (was 13 of 16).
- **Spec first.** `spec.md`, `plan.md` and `tasks.md` were committed
  before any fix, and every commit closes a task.
- **Context artifact.** With `CLAUDE.md`, an AI assistant answered "no
  confirmed Arizona dozer". Without it, it offered the -WY machine (see
  `docs/context-artifact-experiment.md`).
- **Security.** The key moved to Secret Manager (the leaked one is being rotated), and the
  open rule `if true` was replaced by per-collection rules (9/9 tests, live since 2026-11-20).
- **Data fixed at the source:** the 3 contradictory records were corrected
  in production (the ID's state was the true one), so a live run of "machines
  in Arizona" now returns only the 3 Arizona machines.
- **Still open:** one false positive (Q23) and minor data defects (D3–D9).
