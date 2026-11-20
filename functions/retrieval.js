// Retrieval for the CatUsed chatbot (spec.md FR2, FR3, FR5, FR6, FR9).
// Pure functions: no Firebase imports, so they can be unit-tested and
// evaluated offline on data/snapshot.

export const US_STATES = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas",
  CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware",
  DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii",
  ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas",
  KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada",
  NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york",
  NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma",
  OR: "oregon", PA: "pennsylvania", RI: "rhode island",
  SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas",
  UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west virginia", WI: "wisconsin", WY: "wyoming",
};

// Spanish names that differ from the English ones.
const STATE_ALIASES = {
  "carolina del norte": "NC", "carolina del sur": "SC",
  "dakota del norte": "ND", "dakota del sur": "SD",
  "nuevo mexico": "NM", "nueva york": "NY", "nueva jersey": "NJ",
  "virginia occidental": "WV", "luisiana": "LA", "misisipi": "MS",
  "pensilvania": "PA", "tejas": "TX", "hawai": "HI",
};

// Cities buyers mention, mapped to their state.
export const CITY_TO_STATE = {
  "miami": "FL", "orlando": "FL", "tampa": "FL", "jacksonville": "FL",
  "phoenix": "AZ", "tucson": "AZ", "denver": "CO", "houston": "TX",
  "dallas": "TX", "austin": "TX", "san antonio": "TX", "el paso": "TX",
  "las vegas": "NV", "reno": "NV", "salt lake city": "UT",
  "charlotte": "NC", "raleigh": "NC", "atlanta": "GA", "cheyenne": "WY",
  "los angeles": "CA", "san diego": "CA", "chicago": "IL",
  "albuquerque": "NM", "boise": "ID", "seattle": "WA", "portland": "OR",
};

const CATEGORY_WORDS = [
  // [category name in Firestore, normalized phrases (whole words)]
  ["Backhoe Loaders", ["backhoe", "backhoes", "retroexcavadora",
    "retroexcavadoras", "backhoe loader", "backhoe loaders"]],
  ["Excavators", ["excavator", "excavators", "excavadora", "excavadoras"]],
  ["Dozers", ["dozer", "dozers", "bulldozer", "bulldozers", "topadora",
    "topadoras", "track type tractor", "tractor de orugas"]],
  ["Wheel Loaders", ["wheel loader", "wheel loaders", "cargador",
    "cargadores", "cargadora", "cargadoras", "cargador de ruedas"]],
  ["Motor Graders", ["motor grader", "motor graders", "grader", "graders",
    "motoniveladora", "motoniveladoras", "niveladora", "niveladoras"]],
  ["Articulated Trucks", ["articulated truck", "articulated trucks",
    "camion articulado", "camiones articulados"]],
  ["Compactators", ["compactor", "compactors", "compactadora",
    "compactadoras"]],
];

// Words that ask for the inventory in general ("what machines do you have").
const INVENTORY_WORDS = new Set([
  "machine", "machines", "equipment", "equipo", "equipos", "maquina",
  "maquinas", "inventory", "inventario", "available", "disponible",
  "disponibles", "stock", "units", "unidades", "catalog", "catalogo",
]);

// Words that never select documents by themselves (FR9).
export const STOP_WORDS = new Set([
  // English
  "a", "an", "and", "any", "are", "at", "be", "by", "can", "do", "does",
  "for", "from", "get", "give", "have", "has", "how", "i", "in", "is",
  "it", "its", "me", "my", "near", "of", "on", "or", "please", "show",
  "some", "tell", "that", "the", "there", "this", "to", "what", "which",
  "with", "you", "your", "we", "us", "list", "need", "want", "looking",
  "about", "all", "more", "other", "than", "them", "they", "used", "cat",
  "hi", "hello", "thanks", "located", "location", "where",
  // Spanish
  "al", "algun", "alguna", "algunas", "alguno", "algunos", "cual",
  "cuales", "como", "con", "de", "del", "el", "en", "es", "esta", "estan",
  "hay", "la", "las", "lo", "los", "me", "mi", "mis", "muestra",
  "muestrame", "necesito", "para", "por", "que", "quiero", "se", "si",
  "su", "sus", "tiene", "tienen", "tienes", "un", "una", "unas", "unos",
  "usado", "usados", "usada", "usadas", "y", "o", "dame", "busco", "hola",
  "gracias", "donde", "ubicado", "ubicados", "ubicacion",
]);

const SPEC_WORDS = new Set([
  "spec", "specs", "specification", "specifications", "engine", "power",
  "horsepower", "hp", "weight", "capacity", "hours", "year", "details",
  "especificacion", "especificaciones", "ficha", "potencia", "peso",
  "capacidad", "horas", "ano", "detalles", "motor",
]);

/**
 * Lower-case, remove accents and punctuation, collapse spaces.
 * @param {*} text Any value.
 * @return {string} Normalized text.
 */
export function normalize(text) {
  return String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

/**
 * True when `phrase` appears in `text` as whole words (both normalized).
 * @param {string} text Normalized text.
 * @param {string} phrase Normalized phrase.
 * @return {boolean} Match.
 */
function hasPhrase(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * Finds a US place anywhere in a message.
 * @param {string} message User message (any language, any punctuation).
 * @return {?{type: string, name: string, state: string}} Place or null.
 */
export function detectLocation(message) {
  const text = normalize(message);
  const cities = Object.keys(CITY_TO_STATE)
      .sort((a, b) => b.length - a.length);
  for (const city of cities) {
    if (hasPhrase(text, city)) {
      return {type: "city", name: city, state: CITY_TO_STATE[city]};
    }
  }
  const names = [
    ...Object.entries(US_STATES).map(([code, name]) => [name, code]),
    ...Object.entries(STATE_ALIASES),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [name, code] of names) {
    if (hasPhrase(text, name)) {
      return {type: "state", name, state: code};
    }
  }
  // Two-letter codes only in capitals right after a preposition
  // ("machines in AZ"), so "in", "me", "or", "hi" are never states.
  const code = String(message ?? "")
      .match(/\b(?:in|en|from|de|near|at)\s+([A-Z]{2})\b/);
  if (code && US_STATES[code[1]]) {
    return {type: "state", name: US_STATES[code[1]], state: code[1]};
  }
  return null;
}

/**
 * Place recorded in the machine's `location` field.
 * @param {Object} machine Machine document.
 * @return {{state: ?string, city: ?string}} Parsed location.
 */
export function machineLocation(machine) {
  const first = normalize(String(machine?.location ?? "").split(",")[0]);
  if (!first) return {state: null, city: null};
  if (CITY_TO_STATE[first]) return {state: CITY_TO_STATE[first], city: first};
  for (const [code, name] of Object.entries(US_STATES)) {
    if (first === name) return {state: code, city: null};
  }
  return {state: null, city: first};
}

/**
 * State encoded in the machine ID suffix (CAT349-2022-AZ -> AZ).
 * @param {Object} machine Machine document.
 * @return {?string} State code or null.
 */
export function idState(machine) {
  const m = String(machine?.machineId ?? "").match(/-([A-Z]{2})$/);
  return m && US_STATES[m[1]] ? m[1] : null;
}

/**
 * Describes a disagreement between the ID suffix and the location field.
 * @param {Object} machine Machine document.
 * @return {?{idState: string, locationState: ?string, location: string}}
 *   Conflict or null.
 */
export function locationConflict(machine) {
  const fromId = idState(machine);
  const {state} = machineLocation(machine);
  if (fromId && state !== fromId) {
    return {idState: fromId, locationState: state,
      location: machine.location ?? ""};
  }
  return null;
}

/**
 * Categories named in a message.
 * @param {string} text Normalized message.
 * @return {string[]} Category names.
 */
export function detectCategories(text) {
  const found = [];
  for (const [name, phrases] of CATEGORY_WORDS) {
    if (phrases.some((p) => hasPhrase(text, p))) found.push(name);
  }
  return found;
}

/**
 * Model codes named in a message ("CAT 349", "cat349", "D8", "349").
 * @param {string} text Normalized message.
 * @param {Array<Object>} machines Catalogue.
 * @return {string[]} Normalized model codes present in the catalogue.
 */
export function detectModels(text, machines) {
  const codes = new Set(machines.map((m) =>
    normalize(m.model).replace(/^cat\s*/, "").replace(/\s+/g, "")));
  const found = new Set();
  const compact = text.replace(/\bcat\s+(?=[a-z]?\d)/g, "cat");
  for (const token of compact.split(" ")) {
    const code = token.replace(/^cat/, "");
    if (codes.has(code)) found.add(code);
  }
  return [...found];
}

/**
 * Content words of a message (no stop-words, no very short tokens).
 * @param {string} text Normalized message.
 * @return {string[]} Terms.
 */
export function contentTerms(text) {
  return text.split(" ").filter((t) =>
    t.length >= 3 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Selects the machines that answer a message.
 * @param {string} message User message.
 * @param {Array<Object>} machines Catalogue (Firestore data).
 * @param {{lastMachineId: (string|undefined)}} [options] Session context.
 * @return {{location: ?Object, categories: string[], models: string[],
 *   reason: string, matches: Array<Object>, conflicts: Array<Object>}}
 *   Selected machines; conflicts carry a `conflict` description.
 */
export function selectMachines(message, machines, options = {}) {
  const text = normalize(message);
  const location = detectLocation(message);
  const categories = detectCategories(text);
  const models = detectModels(text, machines);
  const modelOf = (m) =>
    normalize(m.model).replace(/^cat\s*/, "").replace(/\s+/g, "");

  let pool = machines;
  if (models.length) pool = pool.filter((m) => models.includes(modelOf(m)));
  if (categories.length) {
    pool = pool.filter((m) => categories.includes(m.category));
  }

  let matches = pool;
  let conflicts = [];
  let reason = "";

  if (location) {
    const inPlace = (m) => machineLocation(m).state === location.state;
    const idInPlace = (m) => idState(m) === location.state;
    matches = pool.filter((m) => inPlace(m) && !locationConflict(m));
    conflicts = pool
        .filter((m) => (inPlace(m) || idInPlace(m)) && locationConflict(m))
        .map((m) => ({...m, conflict: locationConflict(m)}));
    reason = "location";
  } else if (models.length || categories.length) {
    reason = models.length ? "model" : "category";
  } else {
    const terms = contentTerms(text);
    const keyword = machines.filter((m) => {
      const hay = normalize([m.model, m.category, m.description,
        ...(m.specifications ?? [])].join(" "));
      return terms.some((t) => !INVENTORY_WORDS.has(t) && hasPhrase(hay, t));
    });
    const asksInventory = text.split(" ").some((t) => INVENTORY_WORDS.has(t));
    const asksSpecs = text.split(" ").some((t) => SPEC_WORDS.has(t));
    if (keyword.length) {
      matches = keyword;
      reason = "keyword";
    } else if (asksSpecs && options.lastMachineId) {
      matches = machines.filter((m) => m.machineId === options.lastMachineId);
      reason = "follow-up";
    } else if (asksInventory) {
      matches = machines;
      reason = "inventory";
    } else {
      matches = [];
      reason = "none";
    }
  }

  // Inconsistent records are never offered as confirmed matches (FR3).
  if (reason !== "location") {
    conflicts = matches.filter((m) => locationConflict(m))
        .map((m) => ({...m, conflict: locationConflict(m)}));
  }
  return {location, categories, models, reason, matches, conflicts};
}

/**
 * Selects knowledge articles relevant to a message.
 * @param {string} message User message.
 * @param {Array<Object>} knowledge Knowledge documents.
 * @param {number} [limit] Maximum number of articles.
 * @return {Array<Object>} Articles, best first.
 */
export function selectKnowledge(message, knowledge, limit = 5) {
  const terms = contentTerms(normalize(message))
      .filter((t) => !INVENTORY_WORDS.has(t));
  if (!terms.length) return [];
  const scored = knowledge.map((k) => {
    const hay = normalize(`${k.title} ${k.content}`);
    const score = terms.filter((t) => hasPhrase(hay, t) ||
      (t.endsWith("s") && hasPhrase(hay, t.slice(0, -1)))).length;
    return {k, score};
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.k);
}

const SPANISH_WORDS = new Set([
  "que", "cual", "cuales", "cuanto", "cuantos", "cuantas", "como", "donde",
  "hay", "tienen", "tiene", "tienes", "busco", "necesito", "quiero",
  "de", "del", "la", "las", "los", "el", "en", "un", "una", "y", "por",
  "para", "con", "mis", "favoritos", "equipo", "equipos", "maquina",
  "maquinas", "precio", "horas", "peso", "disponible", "disponibles",
  "excavadora", "excavadoras", "cargador", "cargadores", "topadora",
  "topadoras", "motoniveladora", "motoniveladoras", "retroexcavadora",
  "hola", "gracias", "ficha", "tecnica", "especificaciones", "muestrame",
  "dame", "agregar", "agrega", "borrar", "eliminar", "quitar",
]);
const ENGLISH_WORDS = new Set([
  "the", "do", "you", "have", "what", "which", "how", "where", "is", "are",
  "in", "of", "for", "with", "and", "my", "show", "me", "any", "machines",
  "machine", "equipment", "price", "hours", "weight", "available", "hello",
  "thanks", "specs", "add", "remove", "delete", "favorites", "please",
]);

/**
 * Language of a message: "Spanish" or "English" (spec FR1).
 * @param {string} message User message.
 * @return {string} Language name for the prompt.
 */
export function detectLanguage(message) {
  const raw = String(message ?? "");
  if (/[¿¡ñÑáéíóúÁÉÍÓÚ]/.test(raw)) return "Spanish";
  const tokens = normalize(raw).split(" ");
  const es = tokens.filter((t) => SPANISH_WORDS.has(t)).length;
  const en = tokens.filter((t) => ENGLISH_WORDS.has(t)).length;
  return es > en ? "Spanish" : "English";
}
