# Appendix — full reports of the context-experiment runs (verbatim)

Runs of 2026-11-20, Claude Haiku sub-agents, read-only. See
`docs/context-artifact-experiment.md` for the setup.

---

## Run A — no CLAUDE.md — "Do you have dozers in Arizona?"

**Offer:** CATD8-2022-WY (Firestore doc id DPpjvsimX98CF7TbYqGn), CAT D8 dozer, 3600 hours, location Arizona, USA. It is the only machine that is both a Dozer and in Arizona. Verify before offering: the "-WY" suffix contradicts the Arizona location, and its sourceUrl holds junk ("High Drawbar Pull"). Other Arizona machines (CAT 349, CAT 950, CAT 340) are not dozers, so do not offer them. If the data is wrong, the bot should say no Arizona dozer is listed.

**Why the bot gets it wrong today:**
1. The location regex `/\b(?:in|en)\s+([a-zA-Z\s]+)$/i` is anchored to the end, so the trailing "?" makes it fail. `requestedLocation` is null and the bot falls back to term search.
2. With empty history, `searchTerms` ends with an empty string term. `text.includes("")` is always true, so nearly every machine is included. `machineContext[0]` (the Florida CAT 336) is then saved as `lastMachineId`, so a follow-up "add to favorites" saves the wrong machine.
3. Once the location is parsed, all four Arizona machines match. The category filter is required to narrow the result to the D8.

**Proposed diff (not applied):**

```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -300,7 +300,11 @@
     const locationMatch =
-      message.match(/\b(?:in|en)\s+([a-zA-Z\s]+)$/i);
+      message.match(/\b(?:in|en)\s+([a-zA-Z\s]+?)\s*[?.!]*\s*$/i);
 
     const requestedLocation =
       locationMatch ?
         locationMatch[1].trim().toLowerCase() :
         null;
+
+    const requestedCategory =
+      ["dozer", "excavator", "wheel loader", "motor grader", "backhoe"]
+          .find((c) => lowerMessage.includes(c)) || null;
@@ -411,7 +415,8 @@
       conversationHistory
     )
         .toLowerCase()
-        .split(/\s+/);
+        .split(/\s+/)
+        .filter(Boolean);
 
     const knowledgeContext = [];
 
@@ -439,7 +444,12 @@
       let includeMachine = false;
 
       if (requestedLocation) {
-        if (text.includes(requestedLocation)) {
+        const categoryOk =
+          !requestedCategory ||
+          String(data.category || "")
+              .toLowerCase()
+              .includes(requestedCategory);
+        if (text.includes(requestedLocation) && categoryOk) {
           includeMachine = true;
         }
       } else {
```

With this change, the query yields only CATD8-2022-WY. The `.filter(Boolean)` line removes the empty-term bug. Also, "Dozers in Arizona for sale?" still captures "arizona for sale" and matches nothing. A more robust follow-up would match `data.location.split(",")[0]` against `lowerMessage`. This was not tested, since I could not run the function. Repo files were only read, not edited.

---

## Run B — with CLAUDE.md — "Do you have dozers in Arizona?"

**Answer: no confirmed Arizona dozer.** The bot should say so, and may mention one machine only as "location to be confirmed."

**Dozers in `data/machines.json`:**
- `CATD8-2022-WY` (CAT D8): `location` is "Arizona, USA" but the ID suffix is WY. Per CLAUDE.md rule 2 this is a conflict, so offer it only as "location to be confirmed."
- `CATD5-2023-CO` (CAT D5): Colorado. Not offered.
- `CATD6-2021-NV` (CAT D6): Nevada. Not offered.

**Root cause in `functions/index.js`:** the location regex (line ~301) ends with `$`, but "Do you have dozers in Arizona?" ends with "?", so `requestedLocation` is null. The code then falls back to term matching, where "in", "do" and "you" match almost every document (CLAUDE.md rule 1). The bot receives nearly the whole catalogue instead of the Arizona machines. Even with a location, the filter uses `text.includes()` over the whole JSON, not the `location` field.

**Proposed diff (not applied):**

```diff
--- a/functions/index.js
+++ b/functions/index.js
@@ -298,9 +298,14 @@
+    // Strip accents and trailing punctuation ("Arizona?", "¿...?")
+    const cleanMessage = message
+        .normalize("NFD")
+        .replace(/[̀-ͯ]/g, "")
+        .replace(/[?¿!.,;:\s]+$/g, "");
+
     const locationMatch =
-      message.match(/\b(?:in|en)\s+([a-zA-Z\s]+)$/i);
+      cleanMessage.match(/\b(?:in|en)\s+([a-zA-Z\s]+)$/i);
@@ -441,7 +446,13 @@
       if (requestedLocation) {
-        if (text.includes(requestedLocation)) {
+        const place = String(data.location || "")
+            .split(",")[0]
+            .normalize("NFD")
+            .replace(/[̀-ͯ]/g, "")
+            .trim()
+            .toLowerCase();
+        if (place === requestedLocation) {
           includeMachine = true;
         }
       } else {
```

**Remaining gap:** the regex does not handle the `¿` at the start of Spanish questions. The location filter still returns all categories in that state, so Gemini must pick the dozers from context. A follow-up should add a category filter and the suffix-vs-location conflict flag from CLAUDE.md rule 2. Also, CLAUDE.md cites `functions/retrieval.js`, which does not exist in this repo.

---

## Run A2 — no CLAUDE.md — "¿Tienen cargadores de ruedas en Miami?"

Recommendation: offer one machine, CAT966-2023-NV (Firestore doc ID YzoK8FTPtahVvEwsG77U). It is the only wheel loader with location "Miami, USA" (CAT 966, 2023, 321 hp, 23 t).

Do not offer CAT950-2022-AZ (Arizona) or CAT980-2021-UT (Utah). They are wheel loaders but not in Miami. CAT420-2022-GA is in Miami but is a backhoe loader, so leave it out.

Suggested wording (Spanish): "Sí, tenemos un cargador de ruedas en Miami: el CAT 966 (2023, 321 hp, 23 toneladas). ¿Quieres sus especificaciones?"

Problems in the code path (data in functions/index.js, not changed):
1. The location regex ends with `$`, and the message ends with "?", so "Miami" is never detected. The bot falls back to term matching on "en" and "de", which hits almost every machine. The model then sees all wheel loaders, including the Arizona and Utah ones, so it may offer them as available in Miami. The prompt wording alone cannot fix this.
2. "tienen" and "cargadores" are not in the Spanish keyword list, so the reply language defaults to English for this question.
3. Data check: CAT966's machineId ends in "NV" but its location is Miami. Verify before offering it.

---

## Run B2 — with CLAUDE.md — "¿Tienen cargadores de ruedas en Miami?"

Recommendation: offer only CAT966-2023-NV, and say its location still needs confirmation.

- CAT966-2023-NV (Wheel Loaders, 2023, 2200 h, 321 hp): the only wheel loader whose location field says "Miami, USA". Its ID suffix says NV (Nevada), so per CLAUDE.md rule 2 it is a conflict and must not be presented as confirmed in Miami.
- Not offered: CAT420-2022-GA lists Miami but is a Backhoe Loader, not a wheel loader, and its suffix (GA) also conflicts. CAT950-2022-AZ and CAT980-2021-UT are wheel loaders but are located in Arizona and Utah. Mention them only as clearly labeled alternatives outside Miami.

Suggested wording (Spanish): "Tenemos un cargador de ruedas CAT 966 (2023, 2200 horas, 321 hp) registrado en Miami, aunque su ubicación aún debe confirmarse. ¿Quieres que te ayudemos con otras opciones?" Do not quote prices (none exist in the catalogue).

Problems in functions/index.js that will affect this answer:
- The location regex `/\b(?:in|en)\s+([a-zA-Z\s]+)$/i` fails because the message ends in "?", so no location filter applies. Matching falls back to word matching, and "en" matches almost every machine (e.g. "engine").
- responseLanguage stays "English" because none of the Spanish keywords appear in this question, so the reply would be in English (rule 5 violated).
- "cargadores" is never mapped to the "Wheel Loaders" category.
- CLAUDE.md cites functions/retrieval.js, which does not exist in this repo.
