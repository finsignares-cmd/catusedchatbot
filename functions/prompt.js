// Prompt construction for the CatUsed chatbot (spec.md FR1, FR3, FR4, FR7).
// Pure module so the evaluation (eval/) sends exactly the same prompt.

/**
 * Fields of a machine that are shown to the model.
 * @param {Object} m Machine document.
 * @return {Object} Compact machine.
 */
export function machineForPrompt(m) {
  return {
    machineId: m.machineId,
    model: m.model,
    category: m.category,
    year: m.year,
    hours: m.hours,
    location: m.location,
    specifications: m.specifications,
    description: m.description,
  };
}

/**
 * Builds the Gemini prompt.
 * @param {Object} args Inputs.
 * @param {string} args.message User message.
 * @param {string} args.language "English" or "Spanish".
 * @param {string} args.userIntent Detected intent.
 * @param {string} args.conversationHistory Previous turns.
 * @param {Object} args.selection Result of selectMachines().
 * @param {Array<Object>} args.knowledge Selected knowledge articles.
 * @param {Array<Object>} args.categories machineCategories documents.
 * @return {string} Prompt.
 */
export function buildPrompt({message, language, userIntent,
  conversationHistory, selection, knowledge, categories}) {
  const place = selection.location ?
    `${selection.location.name} (US state ${selection.location.state})` :
    "none";
  const matches = selection.matches.map(machineForPrompt);
  const unconfirmed = selection.conflicts.map((m) => ({
    ...machineForPrompt(m),
    dataWarning: `The ID suffix says ${m.conflict.idState} but the ` +
      `location field says "${m.conflict.location}". ` +
      "Location not confirmed.",
  }));
  const knowledgeText = knowledge.map((k) => ({
    title: k.title, content: k.content,
  }));
  const categoryText = categories.map((c) => ({
    name: c.name, description: c.description,
  }));

  return `
You are CatUsed's virtual assistant for used Caterpillar machines.
Always answer in ${language}, the language of the user message.

RULES
1. Only mention machines listed in MATCHING MACHINES or UNCONFIRMED
   LOCATION. Never invent machines, prices, hours or locations. The
   catalogue has no prices: offer to connect the buyer with CatUsed staff.
2. Requested place: ${place}. A machine is "in" that place only if it is in
   MATCHING MACHINES. Never relabel a machine's location.
3. If MATCHING MACHINES is empty and a place was requested, say clearly
   that there is no confirmed machine there.
4. Machines in UNCONFIRMED LOCATION have contradictory data. If you mention
   them, say that their location must be confirmed with CatUsed staff, and
   quote both the machine ID and the location field.
5. If the requested place is a city, say whether the machines are in that
   city or elsewhere in the same state.
6. Be brief: one line per machine (model, machine ID, year, hours,
   location), then one short helpful sentence.

Detected user intent: ${userIntent}
Selection rule used: ${selection.reason}

CONVERSATION HISTORY:
${conversationHistory || "(new conversation)"}

MATCHING MACHINES:
${JSON.stringify(matches)}

UNCONFIRMED LOCATION:
${JSON.stringify(unconfirmed)}

KNOWLEDGE:
${JSON.stringify(knowledgeText)}

MACHINE CATEGORIES:
${JSON.stringify(categoryText)}

USER MESSAGE:
${message}
`;
}
