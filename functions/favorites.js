// Favorites (spec.md FR8): add / list / remove / clear through n8n webhooks.
// Ported from the version deployed on 2026-08-04 (never committed before),
// with the machine lookup moved to retrieval.detectModels and the n8n
// client injected so the flows can be unit-tested (tasks.md T16).
import {normalize, detectModels} from "./retrieval.js";

const N8N = "https://tannery-ought-brewing.ngrok-free.dev/webhook";

/**
 * Calls an n8n webhook (10 s timeout, never throws).
 * @param {string} path Webhook path.
 * @param {object} payload JSON payload.
 * @return {Promise<object>} Parsed answer or {success: false, ...}.
 */
export async function callN8n(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${N8N}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text || !text.trim()) return {success: false, emptyResponse: true};
    try {
      return JSON.parse(text);
    } catch (e) {
      return {success: false, rawResponse: text, parseError: e.message};
    }
  } catch (e) {
    console.error("N8N ERROR:", path, e.message);
    return {success: false, error: e.message};
  } finally {
    clearTimeout(timeout);
  }
}

/** Real n8n client. */
export const n8nClient = {
  list: (userId) => callN8n("listFavoriteMachines", {userId}),
  save: (userId, m) => callN8n("saveFavoriteMachine", {
    userId, machineId: m.machineId, machineModel: m.model,
    year: m.year, location: m.location,
  }),
  remove: (userId, machineId) =>
    callN8n("deleteFavoriteMachine", {userId, machineId}),
  clean: (userId) => callN8n("cleanFavoriteMachines", {userId}),
};

const ADD_VERBS = ["añadir", "añade", "agregar", "agrega", "guardar",
  "guarda", "guárdala", "incorporar", "incorpora", "integrar", "integra",
  "sumar", "suma", "add", "save", "include", "insert", "incorporate"];
const DELETE_VERBS = ["delet", "remov", "eras", "drop", "elimin", "suprim",
  "borra", "quita"];
const FAVORITE_WORDS = ["favorito", "favorite"];
const LIST_PHRASES = ["my favorites", "show my favorites", "list favorites",
  "mis favoritos", "mostrar favoritos", "listar favoritos",
  "lista favoritos", "traer favoritos", "trae favoritos"];
const CLEAN_PHRASES = ["limpiar favoritos", "limpia favoritos",
  "borrar favoritos", "borra favoritos", "eliminar favoritos",
  "elimina favoritos", "clear favorites", "clean favorites",
  "delete all favorites", "remove all favorites", "borrar todos",
  "eliminar todos"];
const CANCEL_WORDS = ["cancelar", "cancel", "olvidalo", "forget it"];

/**
 * Favorite operation requested by a message.
 * @param {string} message User message.
 * @return {?string} "add" | "list" | "clean" | "delete" | null.
 */
export function favoriteIntent(message) {
  const lower = String(message ?? "").toLowerCase();
  const fav = FAVORITE_WORDS.some((w) => lower.includes(w));
  if (!fav) return null;
  if (ADD_VERBS.some((v) => lower.includes(v))) return "add";
  if (CLEAN_PHRASES.some((p) => lower.includes(p))) return "clean";
  if (DELETE_VERBS.some((v) => lower.includes(v))) return "delete";
  if (LIST_PHRASES.some((p) => lower.includes(p))) return "list";
  return null;
}

/**
 * Machine named in a message ("CAT 420", "la 420", "D8").
 * @param {string} message User message.
 * @param {Array<Object>} machines Catalogue.
 * @return {?Object} Machine or null.
 */
export function machineInMessage(message, machines) {
  const [code] = detectModels(normalize(message), machines);
  if (!code) return null;
  return machines.find((m) => normalize(m.model)
      .replace(/^cat\s*/, "").replace(/\s+/g, "") === code) || null;
}

const down = (r) => r?.success === false && !Array.isArray(r?.machines);
// n8n answers {machines: [{}]} for an empty list: ignore empty items.
const listOf = (favs) =>
  (favs?.machines ?? []).filter((f) => f && f.machineId);
const has = (favs, id) => listOf(favs).some((f) => f.machineId === id);

/**
 * Handles favorite requests. Returns the answer, or null when the message
 * is not about favorites (the chat then continues with RAG).
 * @param {Object} ctx Context.
 * @param {string} ctx.message User message.
 * @param {boolean} ctx.es Answer in Spanish.
 * @param {string} ctx.userId Firebase Auth uid sent by the app.
 * @param {Object} ctx.session chatSessions document data ({} if none).
 * @param {Array<Object>} ctx.machines Catalogue.
 * @param {Function} ctx.setSession Merges fields into the session doc.
 * @param {Object} [client] n8n client (injected in tests).
 * @return {Promise<?string>} Answer or null.
 */
export async function handleFavorites(ctx, client = n8nClient) {
  const {message, es, userId, session, machines, setSession} = ctx;
  const t = (spanish, english) => (es ? spanish : english);
  const lower = normalize(message);

  // Second step of "remove a favorite": waiting for the machine.
  if (session.awaitingFavoriteDeletion) {
    if (CANCEL_WORDS.some((w) => lower.includes(w))) {
      await setSession({awaitingFavoriteDeletion: false});
      return t("Operación cancelada.", "Operation cancelled.");
    }
    const machine = machineInMessage(message, machines);
    if (machine) {
      await setSession({awaitingFavoriteDeletion: false});
      return removeOne(machine);
    }
    if (!favoriteIntent(message)) {
      return t("Por favor indica el modelo a eliminar o escribe " +
        "«cancelar».", "Please name the machine to remove, or type " +
        "\"cancel\".");
    }
  }

  const intent = favoriteIntent(message);
  if (!intent) return null;
  if (!userId) {
    return t("Inicia sesión para usar tus favoritos.",
        "Please sign in to use your favorites.");
  }
  // Every flow starts by reading the list: if n8n is unreachable, say so
  // instead of answering "you have no favorites".
  const favs = await client.list(userId);
  if (down(favs)) {
    return t("El servicio de favoritos no está disponible en este " +
      "momento. Intenta de nuevo más tarde.",
    "The favorites service is not available right now. " +
      "Please try again later.");
  }

  if (intent === "add") {
    const named = machineInMessage(message, machines);
    const machine = named || machines.find(
        (m) => m.machineId === session.lastMachineId);
    if (!machine) {
      return t("No tengo contexto de un equipo para agregar a favoritos. " +
        "¿Cuál máquina quieres agregar?",
      "I don't have a machine in context to add to favorites. " +
        "Which one would you like to add?");
    }
    if (has(favs, machine.machineId)) {
      return t(`La máquina ${machine.model} ya está en favoritos.`,
          `${machine.model} is already in favorites.`);
    }
    const r = await client.save(userId, machine);
    return r.success ?
      t(`Máquina ${machine.model} agregada a favoritos correctamente.`,
          `Machine ${machine.model} added to favorites successfully.`) :
      t("No pude agregar la máquina a favoritos.",
          "Could not add the machine to favorites.");
  }

  if (intent === "list") {
    const list = listOf(favs);
    if (!list.length) {
      return t("No tienes máquinas favoritas.",
          "You don't have favorite machines yet.");
    }
    const lines = list.map((f) => `• ${f.machineModel}`).join("\n");
    return t(`⭐ Tus máquinas favoritas:\n\n${lines}`,
        `⭐ Your favorite machines:\n\n${lines}`);
  }

  if (intent === "clean") {
    if (!listOf(favs).length) {
      return t("No tienes máquinas favoritas para eliminar.",
          "You don't have any favorite machines to remove.");
    }
    const r = await client.clean(userId);
    return r.success ?
      t("Todos los favoritos fueron eliminados correctamente.",
          "All favorites were removed successfully.") :
      t("No pude eliminar los favoritos.", "Could not remove favorites.");
  }

  // intent === "delete"
  const machine = machineInMessage(message, machines);
  if (!machine) {
    if (!listOf(favs).length) {
      return t("No tienes máquinas favoritas para eliminar.",
          "You don't have any favorite machines to remove.");
    }
    await setSession({awaitingFavoriteDeletion: true});
    return t("¿Cuál máquina quieres eliminar de favoritos?",
        "Which machine would you like to remove from favorites?");
  }
  return removeOne(machine);

  /**
   * Removes one machine if it is a favorite.
   * @param {Object} m Machine.
   * @return {Promise<string>} Answer.
   */
  async function removeOne(m) {
    const favs = await client.list(userId);
    if (down(favs)) {
      return t("El servicio de favoritos no está disponible en este " +
        "momento.", "The favorites service is not available right now.");
    }
    if (!has(favs, m.machineId)) {
      return t(`La máquina ${m.model} no está en tu lista de favoritos.`,
          `${m.model} is not in your favorites list.`);
    }
    const r = await client.remove(userId, m.machineId);
    return r.success ?
      t(`Máquina ${m.model} eliminada de favoritos correctamente.`,
          `Machine ${m.model} removed from favorites successfully.`) :
      t("No pude eliminar la máquina de favoritos.",
          "Could not remove the machine from favorites.");
  }
}
