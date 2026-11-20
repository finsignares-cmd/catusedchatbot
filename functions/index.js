import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {GoogleGenAI} from "@google/genai";

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {selectMachines, selectKnowledge} from "./retrieval.js";
import {buildPrompt} from "./prompt.js";

initializeApp();

// Gemini API key, stored in Firebase Secret Manager:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const opts = {secrets: [GEMINI_API_KEY]};

// =====================================================
// CLIENTE MCP
// =====================================================
/**
 * Calls an n8n webhook.
 * @param {string} url Webhook URL.
 * @param {object} payload Request payload.
 * @return {Promise<object>}
 */
async function callN8n(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(payload),
  });

  console.log("STATUS:", response.status);

  const text = await response.text();

  console.log("RAW RESPONSE:", text);

  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      rawResponse: text,
      parseError: e.message,
    };
  }
}

const SAVE_FAVORITE_URL =
  "https://tannery-ought-brewing.ngrok-free.dev/webhook/saveFavoriteMachine";

const LIST_FAVORITES_URL =
  "https://tannery-ought-brewing.ngrok-free.dev/webhook/listFavoriteMachines";

const DELETE_FAVORITE_URL =
  "https://tannery-ought-brewing.ngrok-free.dev/webhook/deleteFavoriteMachine";

/**
 * Save favorite machine.
 * @param {string} userId User id.
 * @param {object} machine Machine.
 * @return {Promise<object>}
 */
async function saveFavoriteMachine(
    userId,
    machine,
) {
  return await callN8n(
      SAVE_FAVORITE_URL,
      {
        userId,
        machineId: machine.id,
        machineModel: machine.model,
      },
  );
}

/**
 * List favorite machines.
 * @param {string} userId User id.
 * @return {Promise<object>}
 */
async function listFavoriteMachines(userId) {
  console.log("LIST_FAVORITES_URL:", LIST_FAVORITES_URL);
  console.log("USER ID:", userId);

  return await callN8n(
      LIST_FAVORITES_URL,
      {
        userId,
      },
  );
}

/**
 * Delete favorite machine.
 * @param {string} userId User id.
 * @param {string} machineId Machine id.
 * @return {Promise<object>}
 */
async function deleteFavoriteMachine(
    userId,
    machineId,
) {
  return await callN8n(
      DELETE_FAVORITE_URL,
      {
        userId,
        machineId,
      },
  );
}

export const chat = functions.https.onRequest(opts, async (req, res) => {
  try {
    const message =
      req.body?.message?.toString() || "";

    console.log(
        "REQUEST BODY:",
        JSON.stringify(req.body),
    );

    const lowerMessage = message.toLowerCase();

    // CORS
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    // Datos de entrada

    const sessionId =
      req.body?.sessionId?.toString() || "";

    // Validación
    if (!message.trim()) {
      return res.status(400).json({
        error: "Empty message",
      });
    }

    // Gemini (key from Secret Manager, never from source code)
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY.value(),
    });

    // Firestore
    const db = getFirestore();

    if (
      lowerMessage.includes("test favorite") ||
  lowerMessage.includes("add to favorites") ||
  lowerMessage.includes("save favorite") ||
  lowerMessage.includes("agregar a favoritos") ||
  lowerMessage.includes("guardar favorito") ||
  lowerMessage.includes("agregar favorito")
    ) {
      const sessionDoc = await db
          .collection("chatSessions")
          .doc(sessionId)
          .get();

      const lastMachineId =
      sessionDoc.data()?.lastMachineId;

      const lastMachineModel =
      sessionDoc.data()?.lastMachineModel;

      if (!lastMachineId) {
        return res.status(200).json({
          answer: "Please search for a machine first.",
        });
      }

      const result = await saveFavoriteMachine(
          "test",
          {
            id: lastMachineId,
            model: lastMachineModel,
          },
      );

      console.log(
          "SAVE FAVORITE RESULT:",
          JSON.stringify(result),
      );

      return res.status(200).json({
        answer: JSON.stringify(result),
      });
    }

    if (
      lowerMessage.includes("my favorites") ||
  lowerMessage.includes("show my favorites") ||
  lowerMessage.includes("mis favoritos") ||
  lowerMessage.includes("mostrar favoritos")
    ) {
      console.log("MY FAVORITES TRIGGERED");
      const result =
    await listFavoriteMachines("test");

      if (
        !result.machines ||
    result.machines.length === 0
      ) {
        return res.status(200).json({
          answer:
        "You don't have favorite machines yet.",
        });
      }

      const favoritesList =
    result.machines
        .map(
            (machine) =>
              `• ${machine.machineModel}`,
        )
        .join("\n");

      return res.status(200).json({
        answer:
      `⭐ Your favorite machines:\n\n${favoritesList}`,
      });
    }

    if (
      lowerMessage.includes("delete favorite") ||
  lowerMessage.includes("remove favorite") ||
  lowerMessage.includes("quitar favorito") ||
  lowerMessage.includes("eliminar favorito")
    ) {
      const sessionDoc = await db
          .collection("chatSessions")
          .doc(sessionId)
          .get();

      const lastMachineId =
      sessionDoc.data()?.lastMachineId;

      if (!lastMachineId) {
        return res.status(200).json({
          answer: "Please search for a machine first.",
        });
      }

      const result = await deleteFavoriteMachine(
          "test",
          lastMachineId,
      );

      console.log(
          "DELETE FAVORITE RESULT:",
          JSON.stringify(result),
      );

      return res.status(200).json({
        answer: JSON.stringify(result),
      });
    }

    let conversationHistory = "";
    let waitingForMachineSelection = false;

    if (sessionId) {
      const historySnap = await db
          .collection("chatMessages")
          .where("sessionId", "==", sessionId)
          .orderBy("createdAt", "desc")
          .limit(30)
          .get();

      const historyMessages = [];

      historySnap.forEach((doc) => {
        const msg = doc.data();

        historyMessages.push(
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`,
        );
      });

      historyMessages.reverse();

      conversationHistory = historyMessages.join("\n");

      waitingForMachineSelection =
        conversationHistory
            .toLowerCase()
            .includes(
                "¿de cuál equipo deseas las especificaciones?",
            ) ||
        conversationHistory
            .toLowerCase()
            .includes(
                "which machine would you like specifications for?",
            );
    }

    let responseLanguage = "English";

    const spanishWords = [
      "qué",
      "que",
      "cuál",
      "cual",
      "precio",
      "equipo",
      "equipos",
      "especificacion",
      "especificaciones",
      "caracteristicas",
      "características",
      "horas",
      "motor",
      "peso",
      "capacidad",
      "disponible",
      "disponibles",
    ];

    if (
      spanishWords.some((word) =>
        lowerMessage.includes(word),
      )
    ) {
      responseLanguage = "Spanish";
    }

    let userIntent = "general";

    if (
      waitingForMachineSelection &&
      message.trim().length > 0
    ) {
      userIntent = "specifications";
    }

    // Especificaciones
    if (
      lowerMessage.includes("spec") ||
      lowerMessage.includes("specs") ||
      lowerMessage.includes("specification") ||
      lowerMessage.includes("specifications") ||
      lowerMessage.includes("technical") ||
      lowerMessage.includes("engine") ||
      lowerMessage.includes("motor") ||
      lowerMessage.includes("horsepower") ||
      lowerMessage.includes("hp") ||
      lowerMessage.includes("weight") ||
      lowerMessage.includes("capacity") ||
      lowerMessage.includes("dimension") ||
      lowerMessage.includes("dimensions") ||
      lowerMessage.includes("feature") ||
      lowerMessage.includes("features") ||
      lowerMessage.includes("attachment") ||
      lowerMessage.includes("attachments") ||
      lowerMessage.includes("bucket") ||
      lowerMessage.includes("performance") ||
      lowerMessage.includes("especificacion") ||
      lowerMessage.includes("especificaciones") ||
      lowerMessage.includes("caracteristica") ||
      lowerMessage.includes("caracteristicas") ||
      lowerMessage.includes("características") ||
      lowerMessage.includes("ficha tecnica") ||
      lowerMessage.includes("ficha técnica") ||
      lowerMessage.includes("peso") ||
      lowerMessage.includes("capacidad") ||
      lowerMessage.includes("potencia")
    ) {
      userIntent = "specifications";
    }

    if (
      lowerMessage.includes("price") ||
      lowerMessage.includes("cost") ||
      lowerMessage.includes("value") ||
      lowerMessage.includes("quote")
    ) {
      userIntent = "price";
    }

    if (
      lowerMessage.includes("hour") ||
      lowerMessage.includes("hours")
    ) {
      userIntent = "hours";
    }

    const [
      machinesSnap,
      knowledgeSnap,
      categoriesSnap,
      sessionDoc,
    ] = await Promise.all([
      db.collection("machines").limit(100).get(),
      db.collection("knowledge").limit(100).get(),
      db.collection("machineCategories").get(),
      sessionId ?
        db.collection("chatSessions").doc(sessionId).get() :
        Promise.resolve(null),
    ]);

    const machines = machinesSnap.docs.map((doc) =>
      ({id: doc.id, ...doc.data()}));
    const knowledgeDocs = knowledgeSnap.docs.map((doc) => doc.data());
    const categories = categoriesSnap.docs.map((doc) => doc.data());

    // Retrieval (functions/retrieval.js): location only from the
    // `location` field, ID/location conflicts kept apart (spec FR2-FR9).
    const selection = selectMachines(message, machines, {
      lastMachineId: sessionDoc?.data()?.lastMachineId,
    });
    const knowledgeContext = selectKnowledge(message, knowledgeDocs);

    console.log("SELECTION:", JSON.stringify({
      reason: selection.reason,
      location: selection.location,
      matches: selection.matches.map((m) => m.machineId),
      conflicts: selection.conflicts.map((m) => m.machineId),
    }));

    // Remember the machine only when the answer is about exactly one.
    if (sessionId && selection.matches.length === 1) {
      const only = selection.matches[0];
      await db.collection("chatSessions").doc(sessionId).set({
        lastMachineId: only.machineId,
        lastMachineModel: only.model || "",
      }, {merge: true});
    }

    const prompt = buildPrompt({
      message,
      language: responseLanguage,
      userIntent,
      conversationHistory,
      selection,
      knowledge: knowledgeContext,
      categories,
    });

    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
      });

    return res.status(200).json({
      answer: response.text,
    });
  } catch (error) {
    console.error("Chat error:", error);

    return res.status(500).json({
      error: "Internal server error",
      details:
        error instanceof Error ?
          error.message :
          String(error),
    });
  }
});
