// Proposes (and, only with --apply, writes) fixes for the data defects found
// in the `machines` collection (tasks.md T10, owner step O3).
//
//   node tools/fix_location_conflicts.mjs          # dry-run, snapshot
//   node tools/fix_location_conflicts.mjs --live   # dry-run, Firestore
//   node tools/fix_location_conflicts.mjs --live --apply \
//        --decide CATD8-2022-WY=id --decide CAT420-2022-GA=id ...
//
// Decisions for an ID/location conflict:
//   id    -> the ID suffix is right: set `location` to "<State>, USA"
//   keep  -> leave the record as it is (it stays flagged by the chatbot)
// The machineId is never renamed: favorites in n8n store it.
// "auto" fixes (sourceUrl, stray quote) are written only with --fix-auto.
import {readFileSync} from "node:fs";
import {US_STATES, locationConflict} from "../retrieval.js";

const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Lists proposed changes for the catalogue.
 * @param {Array<Object>} machines Machine documents with `_id`.
 * @param {Object<string,string>} decisions machineId -> "id" | "keep".
 * @return {Array<Object>} Proposed changes.
 */
export function planFixes(machines, decisions = {}) {
  const changes = [];
  for (const m of machines) {
    const c = locationConflict(m);
    if (c) {
      const decision = decisions[m.machineId] ?? "undecided";
      const newLocation = `${title(US_STATES[c.idState])}, USA`;
      changes.push({
        docId: m._id, machineId: m.machineId, kind: "id/location conflict",
        field: "location", from: m.location,
        to: decision === "id" ? newLocation : m.location,
        decision,
        note: `ID says ${c.idState}; location says "${m.location}". ` +
          `Option "id" sets "${newLocation}".`,
      });
    }
    if (m.sourceUrl && !/^https?:\/\//.test(m.sourceUrl)) {
      changes.push({docId: m._id, machineId: m.machineId,
        kind: "sourceUrl is not a URL", field: "sourceUrl",
        from: m.sourceUrl, to: "https://www.cat.com", decision: "auto"});
    }
    const specs = m.specifications ?? [];
    if (specs.some((s) => /"$/.test(s))) {
      changes.push({docId: m._id, machineId: m.machineId,
        kind: "stray quote in specifications", field: "specifications",
        from: specs, to: specs.map((s) => s.replace(/"$/, "")),
        decision: "auto"});
    }
    if (m.description && m.description === m.location) {
      changes.push({docId: m._id, machineId: m.machineId,
        kind: "description is just the location", field: "description",
        from: m.description, to: m.description, decision: "manual",
        note: "Write a real description in the Firebase console."});
    }
  }
  return changes;
}

/**
 * Reads CLI flags.
 * @param {string[]} argv Arguments.
 * @return {{live: boolean, apply: boolean, decisions: Object}} Options.
 */
function parseArgs(argv) {
  const decisions = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--decide") {
      const [id, d] = String(argv[++i]).split("=");
      if (!["id", "keep"].includes(d)) throw new Error(`Bad decision: ${d}`);
      decisions[id] = d;
    }
  }
  return {live: argv.includes("--live"), apply: argv.includes("--apply"),
    fixAuto: argv.includes("--fix-auto"), decisions};
}

/** Entry point. */
async function main() {
  const {live, apply, fixAuto, decisions} = parseArgs(process.argv.slice(2));
  if (apply && !live) throw new Error("--apply needs --live");
  let machines;
  let db;
  if (live) {
    const {initializeApp} = await import("firebase-admin/app");
    const {getFirestore} = await import("firebase-admin/firestore");
    initializeApp();
    db = getFirestore();
    const snap = await db.collection("machines").get();
    machines = snap.docs.map((d) => ({_id: d.id, ...d.data()}));
  } else {
    machines = JSON.parse(readFileSync(new URL(
        "../../data/snapshot/machines.json", import.meta.url), "utf8"));
  }
  const changes = planFixes(machines, decisions);
  console.log(`${live ? "LIVE" : "SNAPSHOT"} - ${machines.length} machines, ` +
    `${changes.length} findings${apply ? "" : " (dry-run, nothing written)"}`);
  for (const c of changes) {
    console.log(`- ${c.machineId} [${c.kind}] ${c.field}: ` +
      `${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)} ` +
      `(${c.decision})${c.note ? " " + c.note : ""}`);
  }
  if (!apply) return;
  const writable = changes.filter((c) =>
    (c.decision === "id" || (fixAuto && c.decision === "auto")) &&
    JSON.stringify(c.from) !== JSON.stringify(c.to));
  for (const c of writable) {
    await db.collection("machines").doc(c.docId).update({[c.field]: c.to});
    console.log(`  written: ${c.machineId}.${c.field}`);
  }
  console.log(`${writable.length} updates written.`);
}

if (process.argv[1] && import.meta.url.endsWith(
    process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
