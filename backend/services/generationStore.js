const { randomBytes } = require('crypto');

const sessions = new Map();
const TTL_MS = 20 * 60 * 1000;

function createSession(totalCount, userId = null) {
  const id = randomBytes(16).toString('hex');
  sessions.set(id, {
    userId: userId ? String(userId) : null,
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

// requestingUserId megadása esetén csak akkor adjuk vissza a sessiont, ha az
// a hívó felhasználóhoz tartozik — enélkül bárki, aki kitalálja/megszerzi egy
// másik felhasználó session ID-ját, megnézhetné annak generálás alatt álló
// kérdéssorát.
function getSession(id, requestingUserId = null) {
  const s = sessions.get(id);
  if (!s) return null;
  if (requestingUserId !== null && s.userId !== null && s.userId !== String(requestingUserId)) {
    return null;
  }
  return s;
}

setInterval(() => {
  const cut = Date.now() - TTL_MS;
  for (const [k, v] of sessions) {
    if (v.ts < cut) sessions.delete(k);
  }
}, 5 * 60 * 1000);

module.exports = { createSession, addChunk, markComplete, markError, getSession };
