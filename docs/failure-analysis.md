# Failure analysis — concrete failures from this project's data

Replaces the generic failure analysis of slides 7 and 10. Every failure below
was reproduced on the catalogue snapshot (`data/snapshot/`, 2026-11-20) with
the original code (`eval/legacy_retrieval.js` = commit `7cfea65`), and is
measured in `eval/results.md`.

## F1 — "Arizona" returns a Wyoming-coded machine (slides 7 and 10)

- **Input:** `machines in arizona`
- **Old output (context sent to Gemini):** CAT349-2022-AZ, **CATD8-2022-WY**,
  CAT950-2022-AZ, CAT340-2022-AZ.
- **Root cause, data (D1):** `CATD8-2022-WY` has `location: "Arizona, USA"`. Its ID
  says Wyoming, its location field says Arizona. One of the two is wrong.
- **Root cause, code:** the filter searched the place name inside the whole
  document JSON, and nothing compared the ID with the location.
- **Fix:** `locationConflict()` in `functions/retrieval.js`; the machine
  goes to an UNCONFIRMED LOCATION block and the prompt (rule 4) makes the bot
  say it must be confirmed. The owner chooses the true location with
  `functions/tools/fix_location_conflicts.mjs`.
- **After:** CAT349-2022-AZ, CAT950-2022-AZ, CAT340-2022-AZ; CATD8-2022-WY flagged.

## F2 — "Miami" returns Georgia- and Nevada-coded machines (slides 7 and 10)

- **Input:** `Equipos disponibles en Miami`
- **Old output:** **CAT420-2022-GA, CAT966-2023-NV**, and nothing else.
- **Root cause, data (D1 + D2):** both records have `location: "Miami, USA"`
  while their IDs say GA and NV. Miami is also the only city in a field that
  otherwise holds states, so the Florida machine (`CAT336-2023-FL`,
  "Florida, USA") was never matched.
- **Fix:** Miami is mapped to Florida, and the two contradictory records are flagged.
- **After:** CAT336-2023-FL (same state, the answer says it is in Florida, not
  in Miami); CAT420-2022-GA and CAT966-2023-NV flagged.

## F3 — A question mark disables the location filter

- **Input:** `Do you have machines in Arizona?`
- **Old output:** **all 14 machines** (and all 30 knowledge docs).
- **Root cause, code:** the regex `/\b(?:in|en)\s+([a-zA-Z\s]+)$/i` only
  matched when the place was the last word, with no `?`, no accent and no
  `¿`. When it failed, the fallback kept every document containing any word of
  the question. Worse, `(message + " " + history).split(/\s+/)` always ends
  with an empty term `""` when the history is empty, and
  `text.includes("")` is always true. So the fallback returned **every**
  document for **every** message, `hello` included. This was found by the
  assistant in `docs/context-artifact-experiment.md` (run A) and checked with
  `node -e`.
- **Scale (measured):** 10 of the 16 location queries in the test set got
  the whole catalogue. In total 13 of 16 offered at least one machine from
  another place (129 wrong-location machines in all).
- **Fix:** `detectLocation()` finds the place anywhere, after normalizing
  accents and punctuation. Keyword fallback ignores stop-words.
- **After:** 0 of 16.

## F4 — Category plus place ignored

- **Input:** `Show me wheel loaders in Arizona`
- **Old output:** all 4 "Arizona" machines, 3 of them excavators or dozers.
- **Fix:** category detection (EN/ES) is combined with the place.
- **After:** CAT950-2022-AZ only.

## F5 — Context flooding

- **Old:** on average 11.2 machines, 30 knowledge docs and 13,975
  characters of context per question, whatever was asked (`hello` included).
- **After:** 2.1 machines, 1.2 knowledge docs, 1,157 characters.

## F6 — Still open after the fix

- **Q23 `Why do maintenance records matter?`:** the new keyword search still
  returns the two motor graders, because their descriptions contain the word
  "maintenance". It is harmless (the right article is also returned), but it
  is a false positive. It is left visible in the results, not tuned away.
- **The data defects D1–D9** (`docs/data-provenance.md`) remain in
  production until the owner applies the fixes.
- **End-to-end (measured 2026-11-20, `eval/e2e_results.md`):** with the old
  code, Gemini told the buyer a machine was in the requested place when it was
  not in 8 of 16 location questions (e.g. "Located in Arizona
  (`CATD8-2022-WY`)"). With the new code: 0 of 16. One wording issue remains:
  Q13 says "no confirmed machines in Florida" when it means "no confirmed
  backhoe".
