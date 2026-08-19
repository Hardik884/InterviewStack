/**
 * yjsCollab.test.js — Full collaborative-editor test against the REAL server.
 *
 * Drives the real Socket.IO server + room/Yjs handlers with clients that
 * replicate the FIXED frontend logic in useYjsEditor.ts:
 *   - starter code seeded with a LOCAL origin, guarded by meta.initialized
 *   - bidirectional sync (client pushes back the diff the server is missing)
 *   - cursors carried as Yjs RELATIVE positions in awareness `selection`
 *
 * Run: node tests/yjsCollab.test.js
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
  removeAwarenessStates,
} = require("y-protocols/awareness");

// ── Stub Mongo + Redis so the realtime layer is tested in isolation ──────────
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
  rateLimit: () => (_q, _s, n) => n(),
  checkSocketConnectionLimit: async () => true,
});
const makeFakeRedis = () => {
  const h = new Map();
  const c = {
    status: "ready",
    on: (e, f) => { if (!h.has(e)) h.set(e, []); h.get(e).push(f); return c; },
    off: () => c,
    subscribe: async () => 1,
    unsubscribe: async () => 1,
    publishBuffer: async () => 1,
    publish: async () => 1,
    duplicate: () => makeFakeRedis(),
    quit: async () => "OK",
    incr: async () => 1,
    pexpire: async () => 1,
    pttl: async () => 1000,
    defineCommand: () => {},
  };
  return c;
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
      const r = origResolve.call(this, request, parent, []);
      if (stubs.has(r)) return stubs.get(r);
    } catch (_) { /* unresolvable here */ }
  }
  return origLoad.call(this, request, parent, isMain);
};

const initSocket = require("../sockets/socketHandler");
const { io: ioClient } = require(
  path.resolve(__dirname, "../../frontend/node_modules/socket.io-client")
);

const DEFAULT_CODE = "// Start coding\n";
const REMOTE = "server";

const tokenFor = (id, name, role) =>
  jwt.sign({ id, name, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const waitFor = (fn, label, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      let ok = false;
      try { ok = fn(); } catch (_) { ok = false; }
      if (ok) return resolve();
      if (Date.now() - t0 > timeoutMs) return reject(new Error(`TIMEOUT: ${label}`));
      setTimeout(tick, 25);
    };
    tick();
  });

/** Client mirroring the FIXED useYjsEditor logic. */
class Client {
  constructor(name, userId, role, port, room) {
    Object.assign(this, { name, userId, role, port, room });
    this.appliedUpdates = 0;
    this.joined = false;
    this.syncReceived = false;
    this.offline = false;
    this._buildDoc();
  }

  _buildDoc() {
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.awareness = new Awareness(this.doc);
    this.doc.on("update", (update, origin) => {
      if (origin === REMOTE) return;
      if (this.offline || !this.socket?.connected) return;
      this.socket.emit("yjs:update", { roomId: this.room, update: Array.from(update) });
    });
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = ioClient(`http://localhost:${this.port}`, {
        transports: ["websocket"],
        auth: { token: tokenFor(this.userId, this.name, this.role) },
        reconnection: false,
      });
      this.socket.on("connect_error", reject);

      this.socket.on("yjs:update", ({ roomId, update }) => {
        if (roomId !== this.room || this.offline) return;
        this.appliedUpdates += 1;
        Y.applyUpdate(this.doc, new Uint8Array(update), REMOTE);
      });

      this.socket.on("yjs:sync-step2", ({ roomId, update, stateVector }) => {
        if (roomId !== this.room) return;
        Y.applyUpdate(this.doc, new Uint8Array(update), REMOTE);
        this.syncReceived = true;

        // Bidirectional: push back what the SERVER is missing.
        if (stateVector && stateVector.length) {
          const diff = Y.encodeStateAsUpdate(this.doc, new Uint8Array(stateVector));
          if (diff.length > 2) {
            this.socket.emit("yjs:update", { roomId, update: Array.from(diff) });
          }
        }

        // Seed starter code ONCE, with a LOCAL origin so it is broadcast.
        const meta = this.doc.getMap("meta");
        if (this.text.length === 0 && !meta.get("initialized")) {
          this.doc.transact(() => {
            this.text.insert(0, DEFAULT_CODE);
            meta.set("initialized", true);
          }, "local-seed");
        }
      });

      this.socket.on("yjs:awareness", ({ roomId, update }) => {
        if (roomId !== this.room) return;
        applyAwarenessUpdate(this.awareness, new Uint8Array(update), REMOTE);
      });

      // Mirrors the hook's user_left handler: prune a departed peer's awareness
      // immediately so no ghost cursor lingers.
      this.socket.on("user_left", ({ userId: leftId }) => {
        if (!leftId) return;
        const toRemove = [];
        this.awareness.getStates().forEach((st, cid) => {
          if (st.user && st.user.id === leftId) toRemove.push(cid);
        });
        if (toRemove.length) removeAwarenessStates(this.awareness, toRemove, "peer-left");
      });

      this.socket.on("room:snapshot", () => {
        this.joined = true;
        this.socket.emit("yjs:sync-step1", {
          roomId: this.room,
          stateVector: Array.from(Y.encodeStateVector(this.doc)),
        });
      });

      this.socket.on("connect", () => {
        this.socket.emit("room:join", { roomId: this.room, name: this.name, role: this.role });
        resolve();
      });
    });
  }

  setCursor(index) {
    const rel = Y.createRelativePositionFromTypeIndex(this.text, index);
    this.awareness.setLocalStateField("user", {
      id: this.userId, name: this.name, role: this.role, color: "#f97316",
    });
    this.awareness.setLocalStateField("selection", { anchor: rel, head: rel });
    const upd = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
    this.socket.emit("yjs:awareness", { roomId: this.room, update: Array.from(upd) });
  }

  /** Resolve a peer's cursor to an absolute index in OUR document. */
  peerCursorIndex() {
    for (const [cid, st] of this.awareness.getStates()) {
      if (cid === this.awareness.clientID) continue;
      if (st.selection && st.selection.head) {
        const abs = Y.createAbsolutePositionFromRelativePosition(
          Y.createRelativePositionFromJSON(st.selection.head), this.doc
        );
        return abs ? abs.index : null;
      }
    }
    return null;
  }

  peerCount() {
    let n = 0;
    for (const [cid, st] of this.awareness.getStates()) {
      if (cid !== this.awareness.clientID && st.selection) n += 1;
    }
    return n;
  }

  close() { try { this.socket.close(); } catch (_) {} }
}

const results = [];
const record = (name, passed, detail) => {
  results.push({ name, passed });
  console.log(`${passed ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n           ${detail}` : ""}`);
};
const check = async (name, fn, detail) => {
  try { await fn(); record(name, true); }
  catch (e) { record(name, false, (detail ? detail() + " | " : "") + e.message); }
};

(async () => {
  const server = http.createServer();
  const io = initSocket(server);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const ROOM = "room-collab";
  console.log(`\nTest server on ${port}\n`);

  const cand = new Client("Candidate", "u-cand", "candidate", port, ROOM);
  const intv = new Client("Interviewer", "u-intv", "interviewer", port, ROOM);

  await cand.connect();
  await waitFor(() => cand.joined && cand.syncReceived, "candidate join+sync");
  await intv.connect();
  await waitFor(() => intv.joined && intv.syncReceived, "interviewer join+sync");
  await new Promise((r) => setTimeout(r, 400));

  await check("TEST 0  starter code seeded exactly once (not duplicated)", async () => {
    await waitFor(() => cand.text.toString() === DEFAULT_CODE && intv.text.toString() === DEFAULT_CODE,
      "both see single starter block");
  }, () => `cand=${JSON.stringify(cand.text.toString())} intv=${JSON.stringify(intv.text.toString())}`);

  // TEST 1 — candidate → interviewer
  cand.text.insert(cand.text.length, "hello");
  await check("TEST 1  candidate types 'hello' -> interviewer sees it", async () => {
    await waitFor(() => intv.text.toString() === cand.text.toString() &&
      intv.text.toString().includes("hello"), "interviewer sees hello");
  }, () => `cand=${JSON.stringify(cand.text.toString())} intv=${JSON.stringify(intv.text.toString())}`);

  // TEST 2 — interviewer → candidate
  intv.text.insert(intv.text.length, " WORLD");
  await check("TEST 2  interviewer edits -> candidate sees it", async () => {
    await waitFor(() => cand.text.toString() === intv.text.toString() &&
      cand.text.toString().includes("WORLD"), "candidate sees WORLD");
  }, () => `cand=${JSON.stringify(cand.text.toString())} intv=${JSON.stringify(intv.text.toString())}`);

  // TEST 3 — rapid typing
  for (let i = 0; i < 150; i++) cand.text.insert(cand.text.length, "x");
  await check("TEST 3  rapid 150-char typing converges", async () => {
    await waitFor(() => intv.text.toString() === cand.text.toString(), "converge");
  }, () => `candLen=${cand.text.length} intvLen=${intv.text.length}`);

  // TEST 4 — simultaneous edits
  cand.text.insert(0, "A");
  intv.text.insert(intv.text.length, "Z");
  await check("TEST 4  simultaneous edits converge (no lost updates)", async () => {
    await waitFor(() => cand.text.toString() === intv.text.toString(), "converge");
    assert.ok(cand.text.toString().includes("A") && cand.text.toString().includes("Z"),
      "both edits survived");
  }, () => `candLen=${cand.text.length} intvLen=${intv.text.length}`);

  // TEST 5 — multi-line delete
  cand.text.delete(0, cand.text.length);
  cand.text.insert(0, "line1\nline2\nline3\nline4\n");
  await waitFor(() => intv.text.toString() === cand.text.toString(), "ml setup").catch(() => {});
  cand.text.delete(6, 12);
  await check("TEST 5  multi-line delete propagates", async () => {
    await waitFor(() => intv.text.toString() === cand.text.toString(), "converge");
    assert.strictEqual(cand.text.toString(), "line1\nline4\n");
  }, () => `cand=${JSON.stringify(cand.text.toString())} intv=${JSON.stringify(intv.text.toString())}`);

  // TEST 6 — large paste
  const big = Array.from({ length: 300 }, (_, i) => `const v${i} = ${i};`).join("\n");
  cand.text.insert(cand.text.length, big);
  await check("TEST 6  large paste (300 lines) syncs exactly", async () => {
    await waitFor(() => intv.text.toString() === cand.text.toString(), "converge", 8000);
  }, () => `candLen=${cand.text.length} intvLen=${intv.text.length}`);

  // TEST 7 — late joiner
  const late = new Client("LateJoiner", "u-late", "candidate", port, ROOM);
  await late.connect();
  await waitFor(() => late.joined, "late join");
  await check("TEST 7  late joiner immediately sees existing code", async () => {
    await waitFor(() => late.text.toString() === cand.text.toString(), "late sync", 6000);
    assert.ok(late.text.length > 1000, "late joiner got the full document");
  }, () => `lateLen=${late.text.length} expected=${cand.text.length}`);

  await check("TEST 7b late joiner does NOT re-seed starter code", async () => {
    const occurrences = late.text.toString().split(DEFAULT_CODE).length - 1;
    assert.ok(occurrences <= 1, `starter code appears ${occurrences} times`);
  });

  // TEST 8/10 — offline edits survive reconnect (bidirectional sync)
  late.close();
  const rejoin = new Client("Candidate", "u-cand2", "candidate", port, ROOM);
  await rejoin.connect();
  await waitFor(() => rejoin.joined && rejoin.syncReceived, "rejoin sync");
  await waitFor(() => rejoin.text.toString() === cand.text.toString(), "rejoin converge", 6000).catch(() => {});

  rejoin.offline = true;                       // simulate network loss
  rejoin.text.insert(0, "/*OFFLINE-EDIT*/");   // edited while disconnected
  await new Promise((r) => setTimeout(r, 200));

  await check("TEST 10a offline edit is NOT yet visible to peers", async () => {
    assert.ok(!cand.text.toString().includes("OFFLINE-EDIT"), "peer must not have it yet");
  });

  rejoin.offline = false;                      // reconnect + re-handshake
  rejoin.socket.emit("yjs:sync-step1", {
    roomId: ROOM, stateVector: Array.from(Y.encodeStateVector(rejoin.doc)),
  });

  await check("TEST 8/10 offline edits reach peers after reconnect (bidirectional sync)", async () => {
    await waitFor(() => cand.text.toString().includes("OFFLINE-EDIT"), "offline edit propagates", 6000);
    await waitFor(() => cand.text.toString() === rejoin.text.toString(), "full convergence", 6000);
  }, () => `candHas=${cand.text.toString().includes("OFFLINE-EDIT")} rejoinLen=${rejoin.text.length} candLen=${cand.text.length}`);

  // TEST 11 — cursor reaches peer
  cand.text.delete(0, cand.text.length);
  cand.text.insert(0, "0123456789ABCDEF");
  await waitFor(() => intv.text.toString() === "0123456789ABCDEF", "cursor setup", 6000).catch(() => {});
  cand.setCursor(10);

  await check("TEST 11 cursor awareness reaches remote peer", async () => {
    await waitFor(() => intv.peerCursorIndex() !== null, "cursor arrives");
    assert.strictEqual(intv.peerCursorIndex(), 10, "cursor at index 10");
  }, () => `resolved=${intv.peerCursorIndex()}`);

  // TEST 12/13 — cursor stays logically correct through edits before it
  cand.text.insert(0, "#####");
  await waitFor(() => intv.text.toString().startsWith("#####"), "shift sync").catch(() => {});
  await check("TEST 12 insert BEFORE remote cursor shifts it correctly (10 -> 15)", async () => {
    await waitFor(() => intv.peerCursorIndex() === 15, "cursor shifted");
  }, () => `resolved=${intv.peerCursorIndex()}`);

  cand.text.delete(0, 3);
  await waitFor(() => !intv.text.toString().startsWith("#####"), "delete sync").catch(() => {});
  await check("TEST 13 delete BEFORE remote cursor shifts it correctly (15 -> 12)", async () => {
    await waitFor(() => intv.peerCursorIndex() === 12, "cursor shifted back");
  }, () => `resolved=${intv.peerCursorIndex()}`);

  // TEST 14 — ghost cursor cleanup
  const ghost = new Client("Ghost", "u-ghost", "candidate", port, ROOM);
  await ghost.connect();
  await waitFor(() => ghost.joined && ghost.syncReceived, "ghost join");
  ghost.setCursor(2);
  await waitFor(() => intv.peerCount() >= 2, "ghost cursor visible", 6000).catch(() => {});
  const beforeLeave = intv.peerCount();
  ghost.close();
  await check("TEST 14 departed participant's cursor disappears", async () => {
    await waitFor(() => intv.peerCount() < beforeLeave, "ghost cursor removed", 6000);
  }, () => `before=${beforeLeave} after=${intv.peerCount()}`);

  // TEST 15 — all remaining clients converge
  await check("TEST 15 all clients converge to identical document", async () => {
    await waitFor(() => cand.text.toString() === intv.text.toString() &&
      cand.text.toString() === rejoin.text.toString(), "3-way convergence", 6000);
  }, () => `c=${cand.text.length} i=${intv.text.length} r=${rejoin.text.length}`);

  // Room isolation
  const otherRoom = new Client("Other", "u-other", "candidate", port, "room-different");
  await otherRoom.connect();
  await waitFor(() => otherRoom.joined && otherRoom.syncReceived, "other room join");
  cand.text.insert(0, "SECRET");
  await new Promise((r) => setTimeout(r, 500));
  await check("ISOLATION  edits do not leak into a different room", async () => {
    assert.ok(!otherRoom.text.toString().includes("SECRET"), "no cross-room leak");
  }, () => `other=${JSON.stringify(otherRoom.text.toString().slice(0, 60))}`);

  [cand, intv, rejoin, otherRoom].forEach((c) => c.close());
  io.close();
  server.close();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("Harness error:", e);
  process.exit(2);
});
