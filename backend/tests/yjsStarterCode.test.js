/**
 * yjsStarterCode.test.js — Reproduces the production collaboration failure.
 *
 * Replicates exactly what frontend/src/hooks/useYjsEditor.ts does today:
 *
 *   1. On yjs:sync-step2, if the Y.Text is empty, insert defaultCode using
 *      doc.transact(..., "server").
 *   2. The doc "update" observer skips forwarding any update whose origin is
 *      "server".
 *
 * => the starter-code insert is applied LOCALLY ONLY and never reaches the
 *    server or the peer. Every client independently creates its own starter
 *    text with its own clientID. Subsequent real edits reference those
 *    local-only items, so peers receive updates with missing dependencies
 *    which Yjs parks in the pending queue and never applies.
 *
 * Run: node tests/yjsStarterCode.test.js
 */

const assert = require("assert");
const Y = require("yjs");

const DEFAULT_CODE = "// Start coding\n";

const results = [];
const record = (name, passed, detail) => {
  results.push({ name, passed });
  console.log(`${passed ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n           ${detail}` : ""}`);
};

/**
 * Simulated client using the CURRENT (buggy) frontend logic.
 * `serverDoc` stands in for the authoritative server-side Y.Doc.
 */
class BuggyClient {
  constructor(label, serverBus) {
    this.label = label;
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.bus = serverBus;

    this.doc.on("update", (update, origin) => {
      // CURRENT FRONTEND BEHAVIOUR: skip anything tagged "server"
      if (origin === "server") return;
      this.bus.publish(this, update);
    });
  }

  receiveSyncStep2(update) {
    Y.applyUpdate(this.doc, update, "server");
    // CURRENT FRONTEND BEHAVIOUR: inject starter code tagged "server"
    if (this.text.length === 0) {
      this.doc.transact(() => {
        this.text.insert(0, DEFAULT_CODE);
      }, "server");
    }
  }

  receiveUpdate(update) {
    Y.applyUpdate(this.doc, update, "server");
  }
}

class FixedClient {
  constructor(label, serverBus) {
    this.label = label;
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.bus = serverBus;

    this.doc.on("update", (update, origin) => {
      if (origin === "server") return;
      this.bus.publish(this, update);
    });
  }

  receiveSyncStep2(update) {
    Y.applyUpdate(this.doc, update, "server");
    // FIXED BEHAVIOUR: inject starter code as a LOCAL origin so it is
    // broadcast to the server and peers like any other edit.
    if (this.text.length === 0) {
      this.doc.transact(() => {
        this.text.insert(0, DEFAULT_CODE);
      }, "local-starter");
    }
  }

  receiveUpdate(update) {
    Y.applyUpdate(this.doc, update, "server");
  }
}

/** Server relay holding the authoritative doc, mirroring yjsHandlers.js. */
class ServerBus {
  constructor() {
    this.doc = new Y.Doc();
    this.clients = [];
    this.doc.on("update", (update, origin) => {
      for (const c of this.clients) {
        if (c === origin) continue;
        c.receiveUpdate(update);
      }
    });
  }
  add(c) {
    this.clients.push(c);
    // sync-step2: send the client everything the server has
    c.receiveSyncStep2(Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(c.doc)));
  }
  publish(from, update) {
    Y.applyUpdate(this.doc, update, from);
  }
}

console.log("\n=== Reproducing the production bug (current frontend logic) ===\n");
{
  const bus = new ServerBus();
  const candidate = new BuggyClient("candidate", bus);
  const interviewer = new BuggyClient("interviewer", bus);

  bus.add(candidate);
  bus.add(interviewer);

  // Both injected starter code locally; server saw nothing.
  record(
    "server doc is EMPTY after both clients injected starter code",
    bus.doc.getText("code").length === 0,
    `server text = ${JSON.stringify(bus.doc.getText("code").toString())}`
  );

  // Candidate types real code after the starter text.
  candidate.text.insert(candidate.text.length, "hello");

  const candText = candidate.text.toString();
  const intvText = interviewer.text.toString();

  record(
    "candidate types 'hello' -> interviewer sees the SAME document",
    candText === intvText,
    `candidate=${JSON.stringify(candText)}\n           interviewer=${JSON.stringify(intvText)}`
  );

  record(
    "interviewer document actually contains 'hello'",
    intvText.includes("hello"),
    `interviewer=${JSON.stringify(intvText)}`
  );

  // Interviewer types back.
  interviewer.text.insert(interviewer.text.length, "WORLD");
  record(
    "interviewer types 'WORLD' -> candidate sees the SAME document",
    candidate.text.toString() === interviewer.text.toString(),
    `candidate=${JSON.stringify(candidate.text.toString())}\n           interviewer=${JSON.stringify(interviewer.text.toString())}`
  );

  // Show pending/missing-dependency state
  const pending = interviewer.doc.store.pendingStructs;
  record(
    "interviewer has NO stuck pending updates (missing dependencies)",
    !pending || pending.missing.size === 0,
    pending ? `pendingStructs.missing = ${JSON.stringify([...pending.missing])}` : "none"
  );
}

console.log("\n=== Same scenario with the fix applied ===\n");
{
  const bus = new ServerBus();
  const candidate = new FixedClient("candidate", bus);
  const interviewer = new FixedClient("interviewer", bus);

  bus.add(candidate);
  bus.add(interviewer);

  record(
    "server doc RECEIVED the starter code",
    bus.doc.getText("code").toString() === DEFAULT_CODE,
    `server text = ${JSON.stringify(bus.doc.getText("code").toString())}`
  );

  record(
    "starter code is NOT duplicated across clients",
    candidate.text.toString() === DEFAULT_CODE && interviewer.text.toString() === DEFAULT_CODE,
    `candidate=${JSON.stringify(candidate.text.toString())} interviewer=${JSON.stringify(interviewer.text.toString())}`
  );

  candidate.text.insert(candidate.text.length, "hello");
  record(
    "candidate types 'hello' -> interviewer sees the SAME document",
    candidate.text.toString() === interviewer.text.toString(),
    `candidate=${JSON.stringify(candidate.text.toString())}\n           interviewer=${JSON.stringify(interviewer.text.toString())}`
  );

  interviewer.text.insert(interviewer.text.length, "WORLD");
  record(
    "interviewer types 'WORLD' -> candidate sees the SAME document",
    candidate.text.toString() === interviewer.text.toString(),
    `candidate=${JSON.stringify(candidate.text.toString())}\n           interviewer=${JSON.stringify(interviewer.text.toString())}`
  );
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed\n`);
