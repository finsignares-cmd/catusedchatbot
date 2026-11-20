// Retrieval logic of the original submission (commit 7cfea65,
// functions/index.js lines 300-306 and 408-461), copied unchanged so the
// evaluation can measure the "before" behaviour on the same data.
// Only the Firestore reads were replaced by plain arrays.

/**
 * Legacy machine/knowledge selection.
 * @param {string} message User message.
 * @param {string} conversationHistory Previous turns ("" for a new chat).
 * @param {Array<Object>} machines Machine docs ({_id, ...fields}).
 * @param {Array<Object>} knowledge Knowledge docs.
 * @return {{requestedLocation: (string|null), machineIds: string[],
 *   knowledgeCount: number, contextChars: number,
 *   machineContext: Array<Object>, knowledgeContext: Array<Object>}}
 *   Selection.
 */
export function legacyRetrieve(message, conversationHistory,
    machines, knowledge) {
  const locationMatch =
    message.match(/\b(?:in|en)\s+([a-zA-Z\s]+)$/i);

  const requestedLocation =
    locationMatch ?
      locationMatch[1].trim().toLowerCase() :
      null;

  const searchTerms = (
    message +
    " " +
    conversationHistory
  )
      .toLowerCase()
      .split(/\s+/);

  const knowledgeContext = [];

  knowledge.forEach((doc) => {
    const {_id, _createTime, ...data} = doc; // eslint-disable-line no-unused-vars
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

  machines.forEach((doc) => {
    const {_id, _createTime, ...data} = doc; // eslint-disable-line no-unused-vars

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
        id: _id,
        ...data,
      });
    }
  });

  return {
    requestedLocation,
    machineIds: machineContext.map((m) => m.machineId),
    knowledgeCount: knowledgeContext.length,
    machineContext,
    knowledgeContext,
    contextChars: JSON.stringify(knowledgeContext).length +
      JSON.stringify(machineContext).length,
  };
}
