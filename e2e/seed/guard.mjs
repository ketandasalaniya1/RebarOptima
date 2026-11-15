/**
 * Test-only Mongo target. Never read backend/.env. Never put a production URI here.
 * Allowed: mongodb://127.0.0.1:27017/rebaroptima_e2e or the same database on localhost.
 */

export const ALLOWED_DB = 'rebaroptima_e2e';
export const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);
export const ALLOWED_URI = 'mongodb://127.0.0.1:27017/rebaroptima_e2e';

const ATLAS_LOG = 'Connected to MongoDB Atlas';
const IN_MEMORY_MARKERS = [
  'In-Memory DB',
  'In-Memory Fallback',
  'Falling back to In-Memory',
];

export function assertSafeMongoUri(uri) {
  if (typeof uri !== 'string' || uri.trim() === '') {
    throw new Error('Refusing empty Mongo URI. An empty URI would fall back to the in-memory database.');
  }
  const raw = uri.trim();
  const lower = raw.toLowerCase();
  if (lower.includes('mongodb+srv')) {
    throw new Error('Refusing mongodb+srv URI.');
  }
  if (lower.includes('mongodb.net')) {
    throw new Error('Refusing mongodb.net URI.');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Refusing unparseable Mongo URI.');
  }
  if (parsed.protocol !== 'mongodb:') {
    throw new Error(`Refusing protocol ${parsed.protocol || '(none)'}.`);
  }
  const host = parsed.hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Refusing host ${host || '(none)'}.`);
  }
  const db = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (db !== ALLOWED_DB) {
    throw new Error(`Refusing database ${db || '(none)'}.`);
  }
  return { uri: raw, host, db };
}

export function resolveMongoUri(env = {}) {
  const given = env.MONGODB_URI;
  if (given == null || String(given).trim() === '') return ALLOWED_URI;
  return assertSafeMongoUri(String(given)).uri;
}

/** @returns {{ abort: true, reason: string } | { abort: false }} */
export function evaluateLogChunk(text) {
  const chunk = String(text ?? '');
  const connectedLog = /Connected to MongoDB( Atlas)? \(([^)/\s]+)\/([^)\s]+)\)/g;
  const memory = IN_MEMORY_MARKERS.find((marker) => chunk.includes(marker));
  if (memory) {
    return { abort: true, reason: `API log contains in-memory fallback marker "${memory}".` };
  }
  if (chunk.includes(ATLAS_LOG) && !/Connected to MongoDB Atlas \(/.test(chunk)) {
    return { abort: true, reason: 'API log contains "Connected to MongoDB Atlas" without a host and database.' };
  }
  for (const match of chunk.matchAll(connectedLog)) {
    const saidAtlas = Boolean(match[1]);
    const host = match[2];
    const db = match[3];
    const atlasHost = host.toLowerCase().endsWith('mongodb.net');
    if (saidAtlas || atlasHost || !ALLOWED_HOSTS.has(host) || db !== ALLOWED_DB) {
      return {
        abort: true,
        reason: `API connected to ${host}/${db}. Only 127.0.0.1 or localhost and ${ALLOWED_DB} are allowed.`,
      };
    }
  }
  return { abort: false };
}
