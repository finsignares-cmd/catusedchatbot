import * as functions from "firebase-functions";
import {defineSecret} from "firebase-functions/params";
import {GoogleGenAI} from "@google/genai";

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

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

    const locationMatch =
      message.match(/\b(?:in|en)\s+([a-zA-Z\s]+)$/i);

    const requestedLocation =
      locationMatch ?
        locationMatch[1].trim().toLowerCase() :
        null;

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
    ] = await Promise.all([
      db.collection("machines").limit(100).get(),
      db.collection("knowledge").limit(100).get(),
      db.collection("machineCategories").get(),
    ]);

    const searchTerms = (
      message +
      " " +
      conversationHistory
    )
        .toLowerCase()
        .split(/\s+/);

    const knowledgeContext = [];

    knowledgeSnap.forEach((doc) => {
      const data = doc.data();
      const text = JSON.stringify(data).toLowerCase();

      if (
        searchTerms.some((term) =>
          text.includes(term),
        )
      ) {
        knowledgeContext.push(data);
      }
    });

    const machineContext = [];

    machinesSnap.forEach((doc) => {
      const data = doc.data();

      const text =
    JSON.stringify(data).toLowerCase();

      let includeMachine = false;

      if (requestedLocation) {
        if (text.includes(requestedLocation)) {
          includeMachine = true;
        }
      } else {
        if (
          searchTerms.some((term) =>
            text.includes(term),
          )
        ) {
          includeMachine = true;
        }
      }

      if (includeMachine) {
        machineContext.push({
          id: doc.id,
          ...data,
        });
      }
    });

    /* AGREGAR DESDE AQUÍ */

    console.log(
        "machineContext final:",
        JSON.stringify(machineContext),
    );

    console.log(
        "sessionId:",
        sessionId,
    );

    console.log(
        "machineContext final:",
        JSON.stringify(machineContext),
    );

    console.log(
        "SESSION ID VALUE:",
        JSON.stringify(sessionId),
    );

    console.log(
        "MACHINE LENGTH VALUE:",
        machineContext.length,
    );

    if (
      machineContext.length > 0 &&
  sessionId
    ) {
      console.log(
          "ABOUT TO SAVE SESSION:",
          sessionId,
      );

      await db
          .collection("chatSessions")
          .doc(sessionId)
          .set({
            lastMachineId: machineContext[0].id,
            lastMachineModel:
          machineContext[0].model ||
          machineContext[0].machineModel ||
          "",
          }, {
            merge: true,
          });

      console.log(
          "SESSION SAVED SUCCESSFULLY",
      );
    }

    /* HASTA AQUÍ */

    const categoryContext = [];

    categoriesSnap.forEach((doc) => {
      categoryContext.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    /* FIN */

    const ragContext =
      "KNOWLEDGE: " +
      JSON.stringify(knowledgeContext) +
      " MACHINE CATEGORIES: " +
      JSON.stringify(categoryContext) +
      " MACHINES: " +
      JSON.stringify(machineContext);

    const prompt = `
You are CatUsed's virtual assistant.

Always answer in ${responseLanguage}.

Detected user intent:
${userIntent}

CONVERSATION HISTORY:
${conversationHistory}

CONTEXT:
${ragContext}

USER MESSAGE:
${message}
`;

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
