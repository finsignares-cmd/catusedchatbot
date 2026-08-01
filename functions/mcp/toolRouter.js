import {callN8nWebhook} from "./n8nClient.js";

/**
 * Executes a tool by name.
 * @param {string} toolName Tool name.
 * @param {Object} params Tool parameters.
 * @return {Promise<Object>} Tool response.
 */
export async function executeTool(toolName, params) {
  switch (toolName) {
    case "saveFavoriteMachine":
      return await callN8nWebhook(
          "saveFavoriteMachine",
          params,
      );

    case "listFavoriteMachines":
      return await callN8nWebhook(
          "listFavoriteMachines",
          params,
      );

    case "deleteFavoriteMachine":
      return await callN8nWebhook(
          "deleteFavoriteMachine",
          params,
      );

    case "clearFavorites":
      return await callN8nWebhook(
          "clearFavorites",
          params,
      );

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
