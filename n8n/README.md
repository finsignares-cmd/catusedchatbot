# n8n workflows for favorites

Exported on 2026-11-20 from the owner's n8n (runs locally on port 5678 and
is published through ngrok at `https://tannery-ought-brewing.ngrok-free.dev`,
started with `ngrok http --url=tannery-ought-brewing.ngrok-free.dev 5678`).
The chatbot calls them from `functions/favorites.js`.

| Workflow | Webhook (POST) | What it does |
|---|---|---|
| `listFavoriteMachines.json` | `/webhook/listFavoriteMachines` | Reads the `favorites` collection and returns the user's machines |
| `saveFavoriteMachine.json` | `/webhook/saveFavoriteMachine` | Creates a document in `favorites` |
| `deleteFavoriteMachine.json` | `/webhook/deleteFavoriteMachine` | Deletes the user's document for one `machineId` |
| `cleanFavoriteMachines.json` | `/webhook/cleanFavoriteMachines` | Deletes **all** the user's documents (only that `userId`) |

Data: Firestore collection `favorites` of the project in `.firebaserc`
(fields `userId`, `machineId`, `machineModel`, `year`, `location`, `createdAt`).
`cleanFavoriteMachines` was missing from the n8n instance and was created on
2026-11-20 by duplicating `deleteFavoriteMachine` and changing its webhook
path and code (filter every document of the `userId`). Checked live with a
test user: add 2 machines, clear, list → empty.

Import: n8n → *Import from file…*, then select the credential
"Google Firebase Cloud Firestore account" (credentials are referenced by name
only; no secret is stored in these files) and publish the workflow.
