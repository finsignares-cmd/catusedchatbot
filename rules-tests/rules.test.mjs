// Firestore security rules tests (spec.md NFR2, tasks.md T5).
// Run: firebase emulators:exec --only firestore --project demo-catused \
//        "npm --prefix rules-tests test"
import {test, before, after, beforeEach} from "node:test";
import {readFileSync} from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
} from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-catused",
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url),
          "utf8"),
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "machines/m1"), {machineId: "CAT349-2022-AZ"});
    await setDoc(doc(db, "users/alice"), {uid: "alice"});
    await setDoc(doc(db, "chatSessions/s1"), {userId: "alice"});
    await setDoc(doc(db, "chatMessages/c1"),
        {userId: "alice", sessionId: "s1", content: "hi"});
  });
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();

test("anonymous users cannot read or write anything", async () => {
  await assertFails(getDoc(doc(anon(), "machines/m1")));
  await assertFails(setDoc(doc(anon(), "machines/x"), {a: 1}));
  await assertFails(getDoc(doc(anon(), "chatMessages/c1")));
  await assertFails(setDoc(doc(anon(), "anything/x"), {a: 1}));
});

test("signed-in users read the catalogue but cannot write it", async () => {
  await assertSucceeds(getDoc(doc(alice(), "machines/m1")));
  await assertFails(setDoc(doc(alice(), "machines/m2"), {a: 1}));
  await assertFails(setDoc(doc(alice(), "knowledge/k1"), {a: 1}));
});

test("unknown collections are closed", async () => {
  await assertFails(setDoc(doc(alice(), "random/x"), {a: 1}));
  await assertFails(getDoc(doc(alice(), "random/x")));
});

test("users/{uid} is private to its owner", async () => {
  await assertSucceeds(getDoc(doc(alice(), "users/alice")));
  await assertFails(getDoc(doc(bob(), "users/alice")));
});

test("chat documents are private to their owner", async () => {
  await assertSucceeds(getDoc(doc(alice(), "chatMessages/c1")));
  await assertFails(getDoc(doc(bob(), "chatMessages/c1")));
  await assertSucceeds(getDoc(doc(alice(), "chatSessions/s1")));
  await assertFails(getDoc(doc(bob(), "chatSessions/s1")));
});

test("users create chat documents only for themselves", async () => {
  await assertSucceeds(setDoc(doc(alice(), "chatMessages/c2"),
      {userId: "alice", sessionId: "s1", content: "x"}));
  await assertFails(setDoc(doc(alice(), "chatMessages/c3"),
      {userId: "bob", sessionId: "s1", content: "x"}));
  await assertFails(updateDoc(doc(alice(), "chatSessions/s1"),
      {userId: "bob"}));
});

test("history queries must be filtered by the caller's userId", async () => {
  const mine = query(collection(alice(), "chatMessages"),
      where("userId", "==", "alice"), where("sessionId", "==", "s1"));
  await assertSucceeds(getDocs(mine));
  const unfiltered = query(collection(alice(), "chatMessages"),
      where("sessionId", "==", "s1"));
  await assertFails(getDocs(unfiltered));
});

test("the FlutterFlow editor account keeps access", async () => {
  const ff = env.authenticatedContext("ff",
      {email: "firebase@flutterflow.io"}).firestore();
  await assertSucceeds(getDoc(doc(ff, "chatMessages/c1")));
});
