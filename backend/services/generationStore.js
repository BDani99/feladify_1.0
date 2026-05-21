const { randomBytes } = require('crypto');

const sessions = new Map();
const TTL_MS = 20 * 60 * 1000;

function createSession(totalCount) {
  const id = randomBytes(16).toString('hex');
  sessions.set(id, {
    sanitized: [],
    full: [],
    totalCount,
    complete: false,
    error: null,
    ts: Date.now()
  });
  return id;
}

function addChunk(id, sanitizedChunk, fullChunk) {
  const s = sessions.get(id);
  if (!s) return;
  s.sanitized.push(...sanitizedChunk);
  s.full.push(...fullChunk);
}

function markComplete(id) {
  const s = sessions.get(id);
  if (s) s.complete = true;
}

function markError(id, msg) {
  const s = sessions.get(id);
  if (s) { s.error = msg; s.complete = true; }
}

function getSession(id) {
  return sessions.get(id) || null;
}

setInterval(() => {
  const cut = Date.now() - TTL_MS;
  for (const [k, v] of sessions) {
    if (v.ts < cut) sessions.delete(k);
  }
}, 5 * 60 * 1000);

module.exports = { createSession, addChunk, markComplete, markError, getSession };
