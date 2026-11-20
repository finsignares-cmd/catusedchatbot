# CLAUDE.md — before / after: how the context artifact changed the model's output

## Setup (run on 2026-11-20)

- Two copies of the **original** code (commit `7cfea65`, Gemini key
  redacted) plus `data/machines.json` (catalogue snapshot). Copy A had **no**
  `CLAUDE.md`. Copy B had this repo's `CLAUDE.md`. Nothing else differed.
- Same AI coding assistant for both: a fresh Claude Code sub-agent (model
  Claude Haiku, read-only). Both got the same prompt:

  > First read any context files at the root of that folder (for example
  > CLAUDE.md or README.md) if they exist, then its code … Task from the
  > product owner: "When a buyer asks the chatbot 'Do you have dozers in
  > Arizona?', which machine(s) should the bot offer? Then propose the code
  > change in functions/index.js …"

- Disclosure: the first run of A was discarded because the agent read
  a different folder (its working directory) instead of copy A. Both
  variants were then re-run with the folder stated more explicitly. B was
  run twice (first and second prompt wording). It gave the same answer
  both times.

## Result

| | Without CLAUDE.md (A) | With CLAUDE.md (B) |
|---|---|---|
| Machine offered | **CATD8-2022-WY offered** as the Arizona dozer, with a side note to "verify" | **"No confirmed Arizona dozer."** CATD8-2022-WY only as "location to be confirmed" |
| Where the place is matched | `text.includes(requestedLocation)` over the **whole document JSON** (the pattern that caused the bug) | only the **`location` field** (`data.location.split(",")[0]`) |
| ID/location conflict | mentioned in prose, not in the proposed code | named as rule 2 and listed as the required follow-up |
| Root cause found | trailing `?` breaks the regex, plus **an empty search term `""` that matches every document** | trailing `?` breaks the regex; stop-words match everything |

### Verbatim excerpts

**A, without CLAUDE.md:**

> **Offer:** CATD8-2022-WY (Firestore doc id DPpjvsimX98CF7TbYqGn), CAT D8
> dozer, 3600 hours, location Arizona, USA. It is the only machine that is
> both a Dozer and in Arizona.

> ```diff
> -        if (text.includes(requestedLocation)) {
> +        if (text.includes(requestedLocation) && categoryOk) {
> ```

**B, with CLAUDE.md:**

> **Answer: no confirmed Arizona dozer.** The bot should say so, and may
> mention one machine only as "location to be confirmed."

> `CATD8-2022-WY` (CAT D8): `location` is "Arizona, USA" but the ID suffix
> is WY. Per CLAUDE.md rule 2 this is a conflict, so offer it only as
> "location to be confirmed."

> ```diff
> -        if (text.includes(requestedLocation)) {
> +        const place = String(data.location || "")
> +            .split(",")[0]
> ```

## What we learned

1. The context file changed the **business decision**, not just the code
   style. Without it, the assistant repeated the bug the reviewer found:
   it offered a "-WY" machine for Arizona.
2. The context file did not make the assistant smarter about everything.
   Agent A found a bug that B missed and the author had not documented: the
   search terms end with an empty string, and `"…".includes("")` is always
   true, so the old fallback returned **every** document for every message.
   That finding was added to `docs/failure-analysis.md` (F3).
3. Limits: one task, one model, one run per variant. This is an
   illustration, not a benchmark.
