import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {GoogleGenAI} from "@google/genai";

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  selectMachines, selectKnowledge, detectLanguage,
} from "./retrieval.js";
import {buildPrompt} from "./prompt.js";
import {handleFavorites} from "./favorites.js";

initializeApp();

// Gemini API key, stored in Firebase Secret Manager:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const opts = {secrets: [GEMINI_API_KEY]};

const SPEC_WORDS = ["spec", "technical", "engine", "motor", "horsepower",
  "hp", "weight", "capacity", "dimension", "feature", "attachment",
  "bucket", "performance", "especificacion", "caracteristica",
  "características", "ficha tecnica", "ficha técnica", "peso", "capacidad",
  "potencia"];

/**
 * Coarse intent label passed to the prompt.
 * @param {string} lower Lower-case message.
 * @param {string} history Conversation history.
 * @return {string} Intent.
 */
function userIntentOf(lower, history) {
  if (lower.includes("hour")) return "hours";
  if (["price", "cost", "value", "quote", "precio"]
      .some((w) => lower.includes(w))) return "price";
  if (SPEC_WORDS.some((w) => lower.includes(w))) return "specifications";
  const h = history.toLowerCase();
  if (h.includes("¿de cuál equipo deseas las especificaciones?") ||
      h.includes("which machine would you like specifications for?")) {
    return "specifications";
  }
  return "general";
}

export const chat = functions.https.onRequest(opts, async (req, res) => {
  try {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    // Input
    const message = req.body?.message?.toString() || "";
    const sessionId = req.body?.sessionId?.toString() || "";
    const userId = req.body?.userId?.toString() || "";
    if (!message.trim()) {
      return res.status(400).json({error: "Empty message"});
    }

    const db = getFirestore();
    const sessionRef = sessionId ?
      db.collection("chatSessions").doc(sessionId) : null;
    const setSession = (fields) => sessionRef ?
      sessionRef.set(fields, {merge: true}) : Promise.resolve();

    const [machinesSnap, sessionDoc] = await Promise.all([
      db.collection("machines").limit(100).get(),
      sessionRef ? sessionRef.get() : Promise.resolve(null),
    ]);
    const machines = machinesSnap.docs.map((doc) =>
      ({id: doc.id, ...doc.data()}));
    const session = sessionDoc?.data() || {};

    // Language (spec FR1). Short follow-ups ("ok", "la 420") keep the
    // language of the session.
    let responseLanguage = detectLanguage(message);
    if (responseLanguage === "English" && session.lastLanguage === "es" &&
        message.trim().split(/\s+/).length <= 3) {
      responseLanguage = "Spanish";
    }
    const es = responseLanguage === "Spanish";
    const answer = async (text) => {
      await setSession({lastLanguage: es ? "es" : "en"});
      return res.status(200).json({answer: text});
    };

    // Favorites (spec FR8, functions/favorites.js): handled by the
    // backend, never by the model.
    const favoriteAnswer = await handleFavorites({
      message, es, userId, session, machines, setSession,
    });
    if (favoriteAnswer) return answer(favoriteAnswer);

    // Conversation history (for the prompt only, never for retrieval).
    let conversationHistory = "";
    if (sessionId) {
      const historySnap = await db
          .collection("chatMessages")
          .where("sessionId", "==", sessionId)
          .orderBy("createdAt", "desc")
          .limit(30)
          .get();
      conversationHistory = historySnap.docs.reverse().map((doc) => {
        const msg = doc.data();
        return `${msg.role === "user" ? "User" : "Assistant"}: ` +
          msg.content;
      }).join("\n");
    }

    const [knowledgeSnap, categoriesSnap] = await Promise.all([
      db.collection("knowledge").limit(100).get(),
      db.collection("machineCategories").get(),
    ]);
    const knowledgeDocs = knowledgeSnap.docs.map((doc) => doc.data());
    const categories = categoriesSnap.docs.map((doc) => doc.data());

    // Retrieval (functions/retrieval.js): location only from the
    // `location` field, ID/location conflicts kept apart (spec FR2-FR9).
    const selection = selectMachines(message, machines, {
      lastMachineId: session.lastMachineId,
    });
    const knowledgeContext = selectKnowledge(message, knowledgeDocs);

    console.log("SELECTION:", JSON.stringify({
      reason: selection.reason,
      location: selection.location,
      matches: selection.matches.map((m) => m.machineId),
      conflicts: selection.conflicts.map((m) => m.machineId),
    }));

    // Remember the machine only when the answer is about exactly one
    // (used by "add it to favorites" and follow-up questions).
    if (selection.matches.length === 1) {
      const only = selection.matches[0];
      await setSession({
        lastMachineId: only.machineId,
        lastMachineModel: only.model || "",
        lastMachineYear: only.year || "",
        lastMachineLocation: only.location || "",
      });
    }

    const prompt = buildPrompt({
      message,
      language: responseLanguage,
      userIntent: userIntentOf(message.toLowerCase(), conversationHistory),
      conversationHistory,
      selection,
      knowledge: knowledgeContext,
      categories,
    });

    // Gemini (key from Secret Manager, never from source code)
    const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY.value()});
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    return answer(response.text || (es ?
      "Lo siento, no pude generar una respuesta. Intenta de nuevo." :
      "Sorry, I couldn't generate an answer. Please try again."));
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
