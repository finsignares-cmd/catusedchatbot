// Unit tests for functions/favorites.js (tasks.md T16), with a fake n8n.
// The phrases are the ones in the app screenshots (deck slides 17-19).
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  favoriteIntent, machineInMessage, handleFavorites,
} from "../favorites.js";

const machines = JSON.parse(readFileSync(
    new URL("../../data/snapshot_fixed/machines.json", import.meta.url),
    "utf8"));

/**
 * Fake n8n store for one user.
 * @param {string[]} ids Initial favorite machine IDs.
 * @return {Object} Client plus the calls it received.
 */
function fakeN8n(ids = []) {
  const store = new Set(ids);
  const calls = [];
  const model = (id) => machines.find((m) => m.machineId === id).model;
  return {
    calls,
    store,
    list: async (u) => {
      calls.push(["list", u]);
      return {machines: [...store].map((id) =>
        ({machineId: id, machineModel: model(id)}))};
    },
    save: async (u, m) => {
      calls.push(["save", u, m.machineId]); store.add(m.machineId);
      return {success: true};
    },
    remove: async (u, id) => {
      calls.push(["remove", u, id]); store.delete(id);
      return {success: true};
    },
    clean: async (u) => {
      calls.push(["clean", u]); store.clear();
      return {success: true};
    },
  };
}

const ctx = (message, extra = {}) => {
  const sessionWrites = [];
  return {
    message, es: false, userId: "u1", session: {}, machines,
    setSession: async (f) => sessionWrites.push(f), sessionWrites, ...extra,
  };
};

test("intent detection (phrases from the app screenshots)", () => {
  assert.equal(favoriteIntent("Add it to favorites"), "add");
  assert.equal(favoriteIntent("Agregarla a mis favoritos"), "add");
  assert.equal(favoriteIntent("Show my favorites"), "list");
  assert.equal(favoriteIntent("Elimina la 420 de favoritos"), "delete");
  assert.equal(favoriteIntent("Clear favorites"), "clean");
  assert.equal(favoriteIntent("borra favoritos"), "clean");
  assert.equal(favoriteIntent("Do you have machines in Arizona?"), null);
});

test("machine named in the message", () => {
  assert.equal(machineInMessage("Elimina la 420 de favoritos", machines)
      .machineId, "CAT420-2022-GA");
  assert.equal(machineInMessage("add the CAT D8", machines).machineId,
      "CATD8-2022-WY");
  assert.equal(machineInMessage("Add it to favorites", machines), null);
});

test("add uses the last machine of the session", async () => {
  const n8n = fakeN8n();
  const a = await handleFavorites(ctx("Agregarla a mis favoritos",
      {es: true, session: {lastMachineId: "CAT340-2022-AZ"}}), n8n);
  assert.equal(a, "Máquina CAT 340 agregada a favoritos correctamente.");
  assert.ok(n8n.store.has("CAT340-2022-AZ"));
});

test("add without context asks which machine", async () => {
  const a = await handleFavorites(ctx("Add it to favorites"), fakeN8n());
  assert.match(a, /Which one would you like to add/);
});

test("add twice says it is already there", async () => {
  const a = await handleFavorites(ctx("add the CAT 420 to my favorites"),
      fakeN8n(["CAT420-2022-GA"]));
  assert.equal(a, "CAT 420 is already in favorites.");
});

test("list, remove a named machine, clear", async () => {
  const n8n = fakeN8n(["CAT420-2022-GA", "CAT340-2022-AZ"]);
  assert.match(await handleFavorites(ctx("Show my favorites"), n8n),
      /• CAT 420\n• CAT 340/);
  assert.equal(await handleFavorites(
      ctx("Elimina la 420 de favoritos", {es: true}), n8n),
  "Máquina CAT 420 eliminada de favoritos correctamente.");
  assert.equal(await handleFavorites(ctx("Clear favorites"), n8n),
      "All favorites were removed successfully.");
  assert.equal(n8n.store.size, 0);
});

test("remove without a machine asks, then the next message completes it",
    async () => {
      const n8n = fakeN8n(["CAT340-2022-AZ"]);
      const first = ctx("remove a favorite");
      assert.match(await handleFavorites(first, n8n), /Which machine/);
      assert.deepEqual(first.sessionWrites, [{awaitingFavoriteDeletion: true}]);
      const second = ctx("the 340",
          {session: {awaitingFavoriteDeletion: true}});
      assert.equal(await handleFavorites(second, n8n),
          "Machine CAT 340 removed from favorites successfully.");
      assert.deepEqual(second.sessionWrites,
          [{awaitingFavoriteDeletion: false}]);
    });

test("not a favorite request: returns null and calls nothing", async () => {
  const n8n = fakeN8n();
  assert.equal(await handleFavorites(ctx("machines in Arizona?"), n8n), null);
  assert.equal(n8n.calls.length, 0);
});

test("favorites need a signed-in user", async () => {
  const a = await handleFavorites(ctx("Show my favorites", {userId: ""}),
      fakeN8n());
  assert.match(a, /sign in/);
});

test("n8n offline: says the service is unavailable", async () => {
  const offline = {list: async () =>
    ({success: false, rawResponse: "<html>offline</html>"})};
  assert.match(await handleFavorites(ctx("Show my favorites"), offline),
      /not available right now/);
});
