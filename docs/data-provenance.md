# Data provenance — Firestore records used by the chatbot

Snapshot analysed: `data/snapshot/` (read-only export, 2026-11-20). Figures
below are computed from that snapshot. The origin of the records was
confirmed by the author on 2026-11-20: **all catalogue data is demo data,
typed by hand** for this project. It does not come from real listings or a
dealer feed.

## Summary

| Collection | Docs | Created (Firestore `createTime`, UTC) | Origin |
|---|---|---|---|
| `machines` | 14 | 2026-07-25 11:21 → 12:07 (46 min) | **Synthetic demo inventory**, typed by hand in the Firebase console. Not real listings. |
| `machineCategories` | 7 | 2026-07-25 10:45 → 11:42 | Hand-written category names and descriptions. |
| `knowledge` | 30 | 20 docs on 2026-07-25 11:36 → 12:25; 10 docs on 2026-08-04 19:06 → 20:27 | Short articles written for the demo; the 2026-08-04 batch is mostly Spanish translations of earlier articles. |
| `chatSessions`, `chatMessages`, `users` | — | written at runtime by the app and the function | User data. **Not** exported, not used for evaluation. |

## Evidence

- **Manual entry.** In all 14 machines `lastUpdated` equals the creation
  minute, the docs were created one every ~3 minutes, and every machine has
  the same 12 fields. That pattern fits console entry, not an import from a
  dealer feed.
- **Source field is generic.** 41 of 44 `sourceUrl` values are
  `https://www.cat.com` (the manufacturer's home page, not a listing). The
  other 3 (`CATD8-2022-WY`, `CAT980-2021-UT`, `CAT150-2021-TX`) contain
  specification text instead of a URL: a copy-paste slip.
- **Specifications are approximate.** Engine power and operating weight are
  in the range of Caterpillar's published figures for each model, but were
  not checked against a specific spec sheet. Units are mixed: 8 machines
  give weight in tons, 6 in kg. The CAT 140 gives a range ("179-231 hp").
- **Year, hours and location are invented** for the demo: years 2021–2023, hours 1,700–5,400.

## Known defects (they explain the failures in `docs/failure-analysis.md`)

| # | Defect | Records |
|---|---|---|
| D1 | ID state suffix contradicts `location` | `CATD8-2022-WY` → "Arizona, USA"; `CAT420-2022-GA` → "Miami, USA"; `CAT966-2023-NV` → "Miami, USA" |
| D2 | `location` mixes a city with states | 2 machines say "Miami, USA"; the other 12 name a state |
| D3 | `description` is just the location | `CATD5-2023-CO` ("Colorado, USA") |
| D4 | `sourceUrl` holds spec text | 3 machines (see above) |
| D5 | Stray quote in a spec | `CAT320-2022-TX`: `Engine Power: 162 hp"` |
| D6 | Categories with no machines / typo | "Compactators" (sic) and "Articulated Trucks" have 0 machines |
| D7 | Duplicate knowledge | 3 pairs with identical content; 2 Spanish-titled docs keep English content ("Cómo comparar máquinas similares.", "Cómo elegir una excavadora…") |
| D8 | Empty article | "Quarry Operations Equipment": content = title |
| D9 | Knowledge categories in two languages | e.g. "Excavators" and "Excavadoras", "Dozers" and "Topadoras" |

## How the defects are handled

- D1 is detected by `functions/retrieval.js` (`locationConflict`). Those
  machines are never presented as being in a place; the prompt lists them
  under UNCONFIRMED LOCATION.
- D2 is handled by mapping cities to states (Miami → Florida).
- **D1 corrected in production on 2026-11-20** (owner's decision: the ID is
  right). The `location` field was set to the ID's state: `CATD8-2022-WY` →
  "Wyoming, USA", `CAT420-2022-GA` → "Georgia, USA", `CAT966-2023-NV` →
  "Nevada, USA" (`fix_location_conflicts.mjs --live --apply --decide …=id`).
  A live dry-run afterwards finds 0 conflicts. `data/snapshot/` is kept as
  the pre-fix baseline used for all measurements.
- **D4 and D5 corrected in production on 2026-11-20** with `--fix-auto`: the
  3 `sourceUrl` fields set to `https://www.cat.com`, and the stray quote
  removed from the CAT 320 spec. - **D3 corrected on 2026-11-20:** the CAT D5 description is now "Mid-size
  crawler dozer for grading, site preparation and general earthmoving, with
  Grade Assist technology." (written from its own record: category, specs).
  A live dry-run afterwards finds 0 defects in the 14 machines.
- D6–D9 are documented, not yet fixed.

## Rights and privacy

The catalogue contains no personal data. Caterpillar model names are used
descriptively. Specification figures are approximate demo values, not copied
from a specific Caterpillar document.
