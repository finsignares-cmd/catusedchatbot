// Fixes data defects D6-D9 (docs/data-provenance.md) in machineCategories
// and knowledge. Each change checks the current value first and is skipped
// if the document no longer looks as expected.
//
//   node tools/fix_catalog_text.mjs                    # dry-run (reads)
//   node tools/fix_catalog_text.mjs --apply            # writes the edits
//   node tools/fix_catalog_text.mjs --apply --delete   # also deletes D7a
//
// Needs GOOGLE_CLOUD_PROJECT and Application Default Credentials.
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Spanish knowledge categories -> the English names used everywhere else.
const CATEGORY_EN = {
  "Excavadoras": "Excavators",
  "Topadoras": "Dozers",
  "Cargadores de Ruedas": "Wheel Loaders",
  "Motoniveladoras de carreteras": "Motor Graders",
  "Logística": "Logistics",
  "Equipos para movimiento de tierras": "Earthmoving",
};

const EDITS = [
  // D6: typo in a category name.
  {col: "machineCategories", id: "g2gK9mjsS30vBbC9zIEx", field: "name",
    from: "Compactators", to: "Compactors"},
  // D7b/c: Spanish titles with English content -> translated content.
  {col: "knowledge", id: "hqMnfLkV7yhxdIFErMTk", field: "title",
    from: "Cómo comparar máquinas similares.",
    to: "Cómo comparar máquinas similares"},
  {col: "knowledge", id: "hqMnfLkV7yhxdIFErMTk", field: "content",
    from: "When comparing similar machines, operators should consider " +
      "machine hours, year, specifications, productivity requirements, " +
      "operating costs and machine location.",
    to: "Al comparar máquinas similares, los operadores deben considerar " +
      "las horas de uso, el año, las especificaciones, los requisitos de " +
      "productividad, los costos de operación y la ubicación de la máquina."},
  {col: "knowledge", id: "Zh0EaYnWgX3uQQMRL6kK", field: "content",
    from: "The CAT 320 is commonly used for general construction, " +
      "utilities, trenching and earthmoving projects. It balances " +
      "productivity, fuel efficiency and operating costs.",
    to: "La CAT 320 se usa comúnmente en construcción general, servicios " +
      "públicos, zanjas y proyectos de movimiento de tierras. Equilibra " +
      "productividad, eficiencia de combustible y costos de operación."},
  // D7d: Spanish article with an English title.
  {col: "knowledge", id: "mTbuEqTOU3vqv7QMheEz", field: "title",
    from: "Large Earthmoving Projects",
    to: "Grandes proyectos de movimiento de tierras"},
  // D8: article whose content was only its title.
  {col: "knowledge", id: "LyO8vYUIuN3ViT5YJTYH", field: "content",
    from: "Quarry Operations Equipment",
    to: "Quarry operations usually combine large hydraulic excavators, " +
      "wheel loaders and dozers for extraction, truck loading and material " +
      "handling."},
];

// D7a: exact English duplicate of "Understanding Machine Hours"
// (4Mzpy26yfmfN7rfVUxX6, kept). Deleted only with --delete.
const DELETE = {col: "knowledge", id: "FGC5fSA6W5uZFmtErXsa",
  title: "Understanding Machine Operating Hours"};

/** Entry point. */
async function main() {
  const apply = process.argv.includes("--apply");
  const del = process.argv.includes("--delete");
  initializeApp();
  const db = getFirestore();

  const edits = [...EDITS];
  // D9: Spanish category names in knowledge -> English.
  const kn = await db.collection("knowledge").get();
  for (const d of kn.docs) {
    const c = d.data().category;
    if (CATEGORY_EN[c]) {
      edits.push({col: "knowledge", id: d.id, field: "category",
        from: c, to: CATEGORY_EN[c]});
    }
  }

  let written = 0;
  for (const e of edits) {
    const ref = db.collection(e.col).doc(e.id);
    const cur = (await ref.get()).data()?.[e.field];
    if (cur === e.to) {
      console.log(`= ${e.col}/${e.id}.${e.field} already fixed`);
      continue;
    }
    if (cur !== e.from) {
      console.log(`! ${e.col}/${e.id}.${e.field} unexpected value, skipped`);
      continue;
    }
    console.log(`- ${e.col}/${e.id}.${e.field}: ` +
      `${JSON.stringify(e.from).slice(0, 50)} -> ` +
      `${JSON.stringify(e.to).slice(0, 60)}`);
    if (apply) {
      await ref.update({[e.field]: e.to});
      written++;
    }
  }

  const dref = db.collection(DELETE.col).doc(DELETE.id);
  const ddoc = await dref.get();
  if (!ddoc.exists) {
    console.log(`= ${DELETE.col}/${DELETE.id} already deleted`);
  } else if (ddoc.data().title !== DELETE.title) {
    console.log(`! ${DELETE.col}/${DELETE.id} unexpected title, not deleted`);
  } else {
    console.log(`- delete ${DELETE.col}/${DELETE.id} ("${DELETE.title}", ` +
      "duplicate)" + (apply && del ? "" : " [needs --apply --delete]"));
    if (apply && del) {
      await dref.delete();
      written++;
    }
  }
  console.log(apply ? `${written} writes.` : "dry-run, nothing written.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
