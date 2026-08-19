/**
 * yjsSync.test.js — End-to-end collaborative-editor synchronisation test.
 *
 * Boots the REAL Socket.IO server with the REAL room + Yjs handlers, connects
 * two authenticated clients (candidate + interviewer) to the same room, and
 * asserts that CRDT document updates and awareness/cursor state actually
 * converge in both directions.
 *
 * Mongo and Redis are stubbed so the test exercises the socket/Yjs layer in
 * isolation (that is the layer under investigation).
 *
 * Run: node tests/yjsSync.test.js
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-yjs-sync";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const http = require("http");
const path = require("path");
const assert = require("assert");
const Module = require("module");
const jwt = require("jsonwebtoken");
const Y = require("yjs");
const {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} = require("y-protocols/awareness");

// ── Stub Mongo-backed room persistence and Redis so this test targets the
//    realtime layer only. ───────────────────────────────────────────────────
const stubs = new Map();
const stubModule = (rel, exports) => stubs.set(path.resolve(__dirname, rel), exports);

stubModule("../services/roomService.js", {
  canonicalRole: (r) =>
    r === "host" || r === "interviewer" ? "interviewer" : r === "observer" ? "observer" : "candidate",
  joinRoom: async ({ requestedRole }) =>
    requestedRole === "host" || requestedRole === "interviewer" ? "interviewer" : "candidate",
  endRoom: async () => {},
});

stubModule("../sockets/roomStateService.js", {
  setYjsSnapshot: async () => {},
  getYjsSnapshot: async () => null,
  setRoomLanguage: async () => {},
  getRoomLanguage: async () => null,
  clearYjsSnapshot: async () => {},
  clearRoomSnapshot: async () => {},
});

stubModule("../middleware/rateLimit.js", {
  rateLimit: () => (_req, _res, next) => next(),
  checkSocketConnectionLimit: async () => true,
});

const publishedMessages = [];
const makeFakeRedis = () => {
  const handlers = new Map();
  const client = {
    status: "ready",
    on: (evt, fn) => {
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(fn);
      return client;
    },
    off: () => client,
    subscribe: async () => 1,
    unsubscribe: async () => 1,
    publishBuffer: async (channel, buf) => {
      publishedMessages.push({ channel, size: buf.length });
      return 1;
    },
    publish: async () => 1,
    duplicate: () => makeFakeRedis(),
    quit: async () => "OK",
    incr: async () => 1,
    pexpire: async () => 1,
    pttl: async () => 1000,
    defineCommand: () => {},
  };
  return client;
};

stubModule("../config/redis.js", {
  redisClient: { isOpen: false, isReady: false, on: () => {}, connect: async () => {} },
  connectRedis: async () => {},
  bullConnection: makeFakeRedis(),
  getRedisHealth: () => ({ cache: "disconnected", bullmq: "disconnected" }),
  maskRedisUrl: (u) => u,
  attachRedisErrorLogger: (e) => e,
});

const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent) {
    try {
      const resolved = origResolve.call(this, request, parent, []);
      if (stubs.has(resolved)) return stubs.get(resolved);
    } catch (_) {
      /* not resolvable here — fall through */
    }
  }
  return origLoad.call(this, request, parent, isMain);
};

const initSocket = require("../sockets/socketHandler");
const { io: ioClient } = require(
  path.resolve(__dirname, "../../frontend/node_modules/socket.io-client")
);

const ROOM = "room-e2e-test";
const tokenFor = (id, name, role) =>
  jwt.sign({ id, name, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const waitFor = (fn, label, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      let ok = false;
      try {
        ok = fn();
      } catch (_) {
        ok = false;
      }
      if (ok) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`TIMEOUT: ${label}`));
      setTimeout(tick, 25);
    };
    tick();
  });

/** Faithful re-implementation of the CLIENT side of the wire protocol. */
class TestClient {
  constructor(name, userId, role, port) {
    this.name = name;
    this.userId = userId;
    this.role = role;
    this.port = port;
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.awareness = new Awareness(this.doc);
    this.syncReceived = false;
    this.appliedUpdates = 0;
    this.awarenessUpdates = 0;
    this.joined = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = ioClient(`http://localhost:${this.port}`, {
        transports: ["websocket"],
        auth: { token: tokenFor(this.userId, this.name, this.role) },
        reconnection: false,
      });

      this.socket.on("connect_error", reject);

      this.doc.on("update", (update, origin) => {
        if (origin === "server") return;
        this.socket.emit("yjs:update", { roomId: ROOM, update: Array.from(update) });
      });

      this.socket.on("yjs:update", ({ roomId, update }) => {
        if (roomId !== ROOM) return;
        this.appliedUpdates += 1;
        Y.applyUpdate(this.doc, new Uint8Array(update), "server");
      });

      this.socket.on("yjs:sync-step2", ({ roomId, update }) => {
        if (roomId !== ROOM) return;
        Y.applyUpdate(this.doc, new Uint8Array(update), "server");
        this.syncReceived = true;
      });

      this.socket.on("yjs:awareness", ({ roomId, update }) => {
        if (roomId !== ROOM) return;
        this.awarenessUpdates += 1;
        applyAwarenessUpdate(this.awareness, new Uint8Array(update), "server");
      });

      this.socket.on("room:snapshot", () => {
        this.joined = true;
        const sv = Y.encodeStateVector(this.doc);
        this.socket.emit("yjs:sync-step1", { roomId: ROOM, stateVector: Array.from(sv) });
      });

      this.socket.on("connect", () => {
        this.socket.emit("room:join", { roomId: ROOM, name: this.name, role: this.role });
        resolve();
      });
    });
  }

  emitAwareness() {
    const update = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
    this.socket.emit("yjs:awareness", { roomId: ROOM, update: Array.from(update) });
  }

  close() {
    try {
      this.socket.close();
    } catch (_) {}
  }
}

const results = [];
const record = (name, passed, detail) => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n           ${detail}` : ""}`);
};

(async () => {
  const server = http.createServer();
  const io = initSocket(server);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  console.log(`\nTest server listening on ${port}\n`);

  const candidate = new TestClient("Candidate", "user-candidate-1", "candidate", port);
  const interviewer = new TestClient("Interviewer", "user-interviewer-1", "interviewer", port);

  await candidate.connect();
  await interviewer.connect();
  await waitFor(() => candidate.joined && interviewer.joined, "both clients to join");
  await new Promise((r) => setTimeout(r, 300));

  // TEST 1 — candidate → interviewer
  candidate.text.insert(0, "hello");
  try {
    await waitFor(() => interviewer.text.toString() === "hello", "interviewer receives 'hello'");
    record("TEST 1  candidate types 'hello' -> interviewer sees it", true);
  } catch (e) {
    record(
      "TEST 1  candidate types 'hello' -> interviewer sees it",
      false,
      `interviewer doc=${JSON.stringify(interviewer.text.toString())} updatesReceived=${interviewer.appliedUpdates}`
    );
  }

  // TEST 2 — interviewer → candidate
  interviewer.text.insert(interviewer.text.length, " world");
  try {
    await waitFor(() => candidate.text.toString() === "hello world", "candidate receives ' world'");
    record("TEST 2  interviewer edits -> candidate sees it", true);
  } catch (e) {
    record(
      "TEST 2  interviewer edits -> candidate sees it",
      false,
      `candidate doc=${JSON.stringify(candidate.text.toString())} updatesReceived=${candidate.appliedUpdates}`
    );
  }

  // TEST 3 — rapid typing
  for (let i = 0; i < 120; i++) candidate.text.insert(candidate.text.length, "x");
  try {
    await waitFor(
      () => interviewer.text.toString() === candidate.text.toString(),
      "convergence after 120 rapid inserts"
    );
    record("TEST 3  rapid 120-char typing converges", true);
  } catch (e) {
    record(
      "TEST 3  rapid 120-char typing converges",
      false,
      `candLen=${candidate.text.length} intvLen=${interviewer.text.length}`
    );
  }

  // TEST 4 — simultaneous edits
  candidate.text.insert(0, "A");
  interviewer.text.insert(interviewer.text.length, "Z");
  try {
    await waitFor(
      () => candidate.text.toString() === interviewer.text.toString(),
      "convergence after simultaneous edits"
    );
    record("TEST 4  simultaneous edits converge (no lost updates)", true);
  } catch (e) {
    record(
      "TEST 4  simultaneous edits converge (no lost updates)",
      false,
      `cand=${JSON.stringify(candidate.text.toString().slice(0, 40))} intv=${JSON.stringify(interviewer.text.toString().slice(0, 40))}`
    );
  }

  // TEST 5 — multi-line delete
  candidate.text.delete(0, candidate.text.length);
  candidate.text.insert(0, "line1\nline2\nline3\nline4\n");
  await waitFor(() => interviewer.text.toString() === candidate.text.toString(), "ml setup").catch(() => {});
  candidate.text.delete(6, 12);
  try {
    await waitFor(
      () => interviewer.text.toString() === candidate.text.toString(),
      "multiline delete sync"
    );
    record("TEST 5  multi-line delete propagates", true);
  } catch (e) {
    record(
      "TEST 5  multi-line delete propagates",
      false,
      `cand=${JSON.stringify(candidate.text.toString())} intv=${JSON.stringify(interviewer.text.toString())}`
    );
  }

  // TEST 6 — large paste
  const bigBlock = Array.from({ length: 200 }, (_, i) => `const v${i} = ${i};`).join("\n");
  candidate.text.insert(candidate.text.length, bigBlock);
  try {
    await waitFor(
      () => interviewer.text.toString() === candidate.text.toString(),
      "large paste sync",
      6000
    );
    record("TEST 6  large paste (200 lines) syncs exactly", true);
  } catch (e) {
    record(
      "TEST 6  large paste (200 lines) syncs exactly",
      false,
      `candLen=${candidate.text.length} intvLen=${interviewer.text.length}`
    );
  }

  // TEST 7 — late joiner
  const observer = new TestClient("LateJoiner", "user-late-1", "candidate", port);
  await observer.connect();
  await waitFor(() => observer.joined, "late joiner joins");
  try {
    await waitFor(
      () => observer.text.toString() === candidate.text.toString(),
      "late joiner receives existing document",
      5000
    );
    record("TEST 7  late joiner immediately sees existing code", true);
  } catch (e) {
    record(
      "TEST 7  late joiner immediately sees existing code",
      false,
      `lateLen=${observer.text.length} expected=${candidate.text.length} syncStep2Received=${observer.syncReceived}`
    );
  }

  // TEST 11 — cursor awareness reaches peer
  candidate.text.delete(0, candidate.text.length);
  candidate.text.insert(0, "0123456789ABCDEF");
  await waitFor(() => interviewer.text.toString() === "0123456789ABCDEF", "cursor setup").catch(() => {});

  const relPos = Y.createRelativePositionFromTypeIndex(candidate.text, 10);
  candidate.awareness.setLocalStateField("user", {
    id: candidate.userId,
    name: "Candidate",
    role: "candidate",
    color: "#f97316",
  });
  candidate.awareness.setLocalStateField("selection", { anchor: relPos, head: relPos });
  candidate.emitAwareness();

  try {
    await waitFor(() => {
      for (const [cid, st] of interviewer.awareness.getStates()) {
        if (cid === interviewer.awareness.clientID) continue;
        if (st.selection && st.selection.head) return true;
      }
      return false;
    }, "interviewer receives cursor awareness");
    record("TEST 11 cursor awareness reaches remote peer", true);
  } catch (e) {
    record(
      "TEST 11 cursor awareness reaches remote peer",
      false,
      `remoteStates=${interviewer.awareness.getStates().size} awarenessUpdates=${interviewer.awarenessUpdates}`
    );
  }

  // TEST 12/13 — cursor stays logically correct after insert BEFORE it
  candidate.text.insert(0, "#####");
  await waitFor(() => interviewer.text.toString().startsWith("#####"), "shift sync").catch(() => {});

  try {
    let resolved = null;
    for (const [cid, st] of interviewer.awareness.getStates()) {
      if (cid === interviewer.awareness.clientID) continue;
      if (st.selection && st.selection.head) {
        const abs = Y.createAbsolutePositionFromRelativePosition(
          Y.createRelativePositionFromJSON(st.selection.head),
          interviewer.doc
        );
        resolved = abs ? abs.index : null;
      }
    }
    assert.strictEqual(resolved, 15, `expected cursor 10 -> 15 after 5 chars inserted before it, got ${resolved}`);
    record("TEST 12/13 cursor keeps correct logical position after edit before it", true);
  } catch (e) {
    record("TEST 12/13 cursor keeps correct logical position after edit before it", false, e.message);
  }

  // TEST 15 — all clients converge
  try {
    await waitFor(
      () =>
        candidate.text.toString() === interviewer.text.toString() &&
        candidate.text.toString() === observer.text.toString(),
      "all three clients converge",
      5000
    );
    record("TEST 15 all clients converge to identical document", true);
  } catch (e) {
    record(
      "TEST 15 all clients converge to identical document",
      false,
      `c=${candidate.text.length} i=${interviewer.text.length} o=${observer.text.length}`
    );
  }

  console.log(`\nYjs Redis pub/sub publishes recorded: ${publishedMessages.length}`);

  candidate.close();
  interviewer.close();
  observer.close();
  io.close();
  server.close();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error("Harness error:", err);
  process.exit(2);
});
