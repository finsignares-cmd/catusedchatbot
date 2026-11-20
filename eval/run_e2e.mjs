// End-to-end evaluation with Gemini: old prompt+retrieval vs new, on the
// location queries of eval/queries.json (tasks.md T13, needs owner step O1).
//
// Needs a VALID, ROTATED key in the environment (never commit it):
//   PowerShell:  $env:GEMINI_API_KEY = "<new key>"; node eval/run_e2e.mjs
// Writes eval/e2e_results.md and eval/e2e_results.json.
import {readFileSync, writeFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {createRequire} from "node:module";
import {legacyRetrieve} from "./legacy_retrieval.js";
import {selectMachines, selectKnowledge, machineLocation, idState} from
  "../functions/retrieval.js";
import {buildPrompt} from "../functions/prompt.js";

const require = createRequire(new URL("../functions/", import.meta.url));
const {GoogleGenAI} = require("@google/genai");
const MODEL = "gemini-3.5-flash-lite"; // same model as functions/index.js

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Set GEMINI_API_KEY (the rotated key) first.");
  process.exit(1);
}
const ai = new GoogleGenAI({apiKey: key});
const FIXED = process.argv.includes("--data") &&
  process.argv[process.argv.indexOf("--data") + 1] === "fixed";
const SNAP = FIXED ? "snapshot_fixed" : "snapshot";
const OUT = FIXED ? "e2e_results_fixed" : "e2e_results";
const here = (p) => new URL(p, import.meta.url);
const read = (p) => JSON.parse(readFileSync(here(p), "utf8"));
const machines = read(`../data/${SNAP}/machines.json`);
const knowledge = read(`../data/${SNAP}/knowledge.json`);
const categories = read(`../data/${SNAP}/machineCategories.json`);
const queries = read("./queries.json").queries
    .filter((q) => q.type === "location");
const strip = ({_id, _createTime, ...d}) => d; // eslint-disable-line

/**
 * Old prompt of 7cfea65 (lines 530-554), rebuilt with the old retrieval.
 * @param {Object} q Query.
 * @return {string} Prompt.
 */
function legacyPrompt(q) {
  const sel = legacyRetrieve(q.text, "", machines, knowledge);
  const ms = sel.machineContext;
  const kn = sel.knowledgeContext;
  const rag = "KNOWLEDGE: " + JSON.stringify(kn) +
    " MACHINE CATEGORIES: " + JSON.stringify(categories.map((c) =>
      ({id: c._id, ...strip(c)}))) +
    " MACHINES: " + JSON.stringify(ms);
  const lang = q.lang === "es" ? "Spanish" : "English";
  return `\nYou are CatUsed's virtual assistant.\n\nAlways answer in ${lang}.` +
    `\n\nDetected user intent:\ngeneral\n\nCONVERSATION HISTORY:\n\n\n` +
    `CONTEXT:\n${rag}\n\nUSER MESSAGE:\n${q.text}\n`;
}

/**
 * New prompt (functions/prompt.js) with the new retrieval.
 * @param {Object} q Query.
 * @return {string} Prompt.
 */
function newPrompt(q) {
  return buildPrompt({
    message: q.text, language: q.lang === "es" ? "Spanish" : "English",
    userIntent: "general", conversationHistory: "",
    selection: selectMachines(q.text, machines),
    knowledge: selectKnowledge(q.text, knowledge), categories,
  });
}

const WARN = /(confirm|verif|contradict|inconsisten|unconfirmed)/i;

/**
 * Machines named in an answer that are not really in the requested state,
 * and whether the answer warns about them.
 * @param {string} answer Model answer.
 * @param {Object} q Query.
 * @return {{wrong: string[], warned: boolean}} Check.
 */
function check(answer, q) {
  const wrong = machines.filter((m) => answer.includes(m.machineId) &&
    (machineLocation(m).state !== q.state || idState(m) !== q.state))
      .map((m) => m.machineId);
  return {wrong, warned: WARN.test(answer)};
}

const rows = [];
for (const q of queries) {
  for (const [variant, build] of [["old", legacyPrompt], ["new", newPrompt]]) {
    const prompt = build(q);
    const t0 = performance.now();
    const r = await ai.models.generateContent({model: MODEL,
      contents: prompt});
    const ms = Math.round(performance.now() - t0);
    const answer = r.text ?? "";
    rows.push({id: q.id, variant, query: q.text, ms,
      promptChars: prompt.length, answer, ...check(answer, q)});
    console.log(q.id, variant, ms, "ms");
  }
}

const sum = (v) => {
  const r = rows.filter((x) => x.variant === v);
  const lat = r.map((x) => x.ms).sort((a, b) => a - b);
  return {
    n: r.length,
    unwarnedWrong: r.filter((x) => x.wrong.length && !x.warned).length,
    anyWrong: r.filter((x) => x.wrong.length).length,
    p50: lat[Math.floor(lat.length / 2)],
    avgPrompt: Math.round(r.reduce((s, x) => s + x.promptChars, 0) / r.length),
  };
};
const O = sum("old");
const N = sum("new");
const md = [
  "# End-to-end evaluation with Gemini — measured results", "",
  `\`node eval/run_e2e.mjs\`, model \`${MODEL}\`, ` +
    `${new Date().toISOString().slice(0, 10)}, ${queries.length} location ` +
    `queries, data/${SNAP}.`, "",
  "| Metric | Old | New |", "|---|---|---|",
  `| Answers naming a wrong-location machine without a warning | ` +
    `${O.unwarnedWrong} / ${O.n} | ${N.unwarnedWrong} / ${N.n} |`,
  `| Answers naming any wrong-location machine | ${O.anyWrong} / ${O.n} | ` +
    `${N.anyWrong} / ${N.n} |`,
  `| Median latency (ms) | ${O.p50} | ${N.p50} |`,
  `| Avg. prompt size (characters) | ${O.avgPrompt} | ${N.avgPrompt} |`,
  "", `Raw answers: \`eval/${OUT}.json\`.`,
].join("\n");
writeFileSync(here(`./${OUT}.md`), md + "\n");
writeFileSync(here(`./${OUT}.json`), JSON.stringify(rows, null, 2));
console.log(md);
