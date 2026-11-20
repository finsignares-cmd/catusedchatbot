// Language detection, old (7cfea65 lines 308-336, verbatim list) vs new
// (functions/retrieval.js detectLanguage) on the 24 labelled queries.
import {readFileSync, writeFileSync} from "node:fs";
import {detectLanguage} from "../functions/retrieval.js";

const OLD_WORDS = ["qué", "que", "cuál", "cual", "precio", "equipo",
  "equipos", "especificacion", "especificaciones", "caracteristicas",
  "características", "horas", "motor", "peso", "capacidad", "disponible",
  "disponibles"];
const old = (m) => OLD_WORDS.some((w) => m.toLowerCase().includes(w)) ?
  "Spanish" : "English";
const {queries} = JSON.parse(readFileSync(
    new URL("./queries.json", import.meta.url), "utf8"));
const want = (q) => q.lang === "es" ? "Spanish" : "English";
const rows = queries.map((q) => ({id: q.id, text: q.text, expected: want(q),
  old: old(q.text), new: detectLanguage(q.text)}));
const ok = (k) => rows.filter((r) => r[k] === r.expected).length;
const md = ["# Answer language — measured results", "",
  "`node eval/run_lang.mjs` on the 24 labelled queries (7 Spanish, 17 English).", "",
  "| | Old | New |", "|---|---|---|",
  `| Queries answered in the right language | ${ok("old")} / ${rows.length} | ${ok("new")} / ${rows.length} |`,
  "", "Wrong with the old list:",
  ...rows.filter((r) => r.old !== r.expected).map((r) =>
    `- ${r.id} \`${r.text}\` → ${r.old}`), ""].join("\n");
writeFileSync(new URL("./lang_results.md", import.meta.url), md);
console.log(md);
