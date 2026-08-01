const N8N_BASE_URL = process.env.N8N_BASE_URL;

/**
 * Calls an n8n webhook.
 * @param {string} path Webhook path.
 * @param {Object} payload Request payload.
 * @return {Promise<Object>} JSON response.
 */
export async function callN8nWebhook(path, payload) {
  const response = await fetch(
      `${N8N_BASE_URL}/${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
  );

  return await response.json();
}
