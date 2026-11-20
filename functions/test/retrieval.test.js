// Unit tests for functions/retrieval.js (tasks.md T7).
// Data: the real catalogue snapshot in data/snapshot (2026-11-20).
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  normalize, detectLocation, machineLocation, idState, locationConflict,
  detectModels, selectMachines, selectKnowledge,
} from "../retrieval.js";

const load = (name) => JSON.parse(readFileSync(
    new URL(`../../data/snapshot/${name}.json`, import.meta.url), "utf8"));
const machines = load("machines");
const knowledge = load("knowledge");
const ids = (r) => r.matches.map((m) => m.machineId).sort();
const conflictIds = (r) => r.conflicts.map((m) => m.machineId).sort();

test("normalize removes accents, punctuation and case", () => {
  assert.equal(normalize("¿Qué EXCAVADORAS hay en Arizona?"),
      "que excavadoras hay en arizona");
});

test("detectLocation finds the place anywhere, with any punctuation", () => {
  for (const q of ["Do you have machines in Arizona?",
    "machines in arizona", "Arizona: what do you have",
    "¿Qué equipos hay en Arizona?", "anything in AZ?"]) {
    assert.equal(detectLocation(q)?.state, "AZ", q);
  }
  assert.deepEqual(detectLocation("Equipos disponibles en Miami."),
      {type: "city", name: "miami", state: "FL"});
  assert.equal(detectLocation("Carolina del Norte").state, "NC");
});

test("detectLocation ignores words that look like state codes", () => {
  for (const q of ["show me the specs", "is it ok or not", "hi, help me",
    "what do you have in stock"]) {
    assert.equal(detectLocation(q), null, q);
  }
});

test("location field and ID suffix are parsed separately", () => {
  const d8 = machines.find((m) => m.machineId === "CATD8-2022-WY");
  assert.equal(machineLocation(d8).state, "AZ");
  assert.equal(idState(d8), "WY");
  assert.deepEqual(locationConflict(d8),
      {idState: "WY", locationState: "AZ", location: "Arizona, USA"});
});

test("the snapshot has exactly 3 ID/location conflicts", () => {
  const bad = machines.filter((m) => locationConflict(m))
      .map((m) => m.machineId).sort();
  assert.deepEqual(bad,
      ["CAT420-2022-GA", "CAT966-2023-NV", "CATD8-2022-WY"]);
});

test("Arizona returns only consistent Arizona machines (reviewer case)", () => {
  const r = selectMachines("Do you have machines in Arizona?", machines);
  assert.deepEqual(ids(r),
      ["CAT340-2022-AZ", "CAT349-2022-AZ", "CAT950-2022-AZ"]);
  assert.deepEqual(conflictIds(r), ["CATD8-2022-WY"]);
});

test("Miami never offers the -GA / -NV records as Miami machines", () => {
  const r = selectMachines("Equipos disponibles en Miami", machines);
  assert.deepEqual(ids(r), ["CAT336-2023-FL"]);
  assert.deepEqual(conflictIds(r), ["CAT420-2022-GA", "CAT966-2023-NV"]);
});

test("location + category", () => {
  const r = selectMachines("¿Qué excavadoras hay en Arizona?", machines);
  assert.deepEqual(ids(r), ["CAT340-2022-AZ", "CAT349-2022-AZ"]);
});

test("a state with no confirmed machine returns no match", () => {
  const r = selectMachines("Any dozers in Wyoming?", machines);
  assert.deepEqual(ids(r), []);
  assert.deepEqual(conflictIds(r), ["CATD8-2022-WY"]);
});

test("model queries", () => {
  assert.deepEqual(detectModels(normalize("specs of the CAT 349"), machines),
      ["349"]);
  assert.deepEqual(ids(selectMachines("cat349 hours?", machines)),
      ["CAT349-2022-AZ"]);
  assert.deepEqual(ids(selectMachines("Ficha técnica de la CAT D6", machines)),
      ["CATD6-2021-NV"]);
});

test("stop-words alone select nothing", () => {
  const r = selectMachines("do you have it?", machines);
  assert.deepEqual(ids(r), []);
});

test("follow-up uses the last machine of the session", () => {
  const r = selectMachines("what are the specs?", machines,
      {lastMachineId: "CAT950-2022-AZ"});
  assert.deepEqual(ids(r), ["CAT950-2022-AZ"]);
});

test("knowledge selection ignores stop-words", () => {
  const k = selectKnowledge("Why do maintenance records matter?", knowledge);
  assert.ok(k.length >= 1);
  assert.equal(k[0].title, "Why Maintenance Records Matter");
  assert.deepEqual(selectKnowledge("do you have it?", knowledge), []);
});

test("detectLanguage (FR1)", async () => {
  const {detectLanguage} = await import("../retrieval.js");
  for (const q of ["¿Tienen cargadores de ruedas en Miami?",
    "Equipos disponibles en Miami", "tienen topadoras en texas",
    "ficha tecnica de la cat 966"]) {
    assert.equal(detectLanguage(q), "Spanish", q);
  }
  for (const q of ["Do you have machines in Arizona?", "motor grader specs",
    "Show me your excavators", "any technique question"]) {
    assert.equal(detectLanguage(q), "English", q);
  }
});
