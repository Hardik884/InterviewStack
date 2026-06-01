/**
 * codeHandlers.js
 *
 * DEPRECATED — All code synchronisation is now handled by yjsHandlers.js
 * via Yjs CRDT binary updates.
 *
 * This file is intentionally empty. It is kept only to avoid breaking any
 * dynamic requires that reference it by path. The events previously handled
 * here (code:sync, cursor:move, selection:change, typing:start, typing:stop)
 * have been removed:
 *
 *   code:sync         → replaced by yjs:update (Yjs binary delta)
 *   language:change   → handled in yjsHandlers.js (Y.Map + language:changed)
 *   cursor:move       → replaced by yjs:awareness (Yjs Awareness protocol)
 *   selection:change  → replaced by yjs:awareness (Yjs Awareness protocol)
 *   typing:start/stop → replaced by yjs:awareness (isTyping field)
 *
 * Remove this file once all import references are cleaned up.
 */

const registerCodeHandlers = (_io, _socket) => {
  // No-op. All collaborative editing is handled by registerYjsHandlers.
};

module.exports = { registerCodeHandlers };
