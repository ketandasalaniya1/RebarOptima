import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALLOWED_URI } from './seed/guard.mjs';
import { buildApiEnv, spawnGuardedApi, superviseLogs } from './start-api.mjs';

test('runner aborts if the API logs Connected to MongoDB Atlas', () => {
  let killed = false;
  const child = { kill() { killed = true; } };
  assert.throws(
    () => superviseLogs(child, '✅ Connected to MongoDB Atlas\n'),
    (err) => err.code === 'E2E_API_ABORT' && /Connected to MongoDB Atlas/.test(err.message),
  );
  assert.equal(killed, true);
});

test('runner aborts on both in-memory fallback log lines and does not continue', () => {
  const lines = [
    '⚠️ Could not connect to MONGODB_URI. Falling back to In-Memory DB: timeout',
    '⚠️ MongoDB Atlas is not accessible. Using clean In-Memory DB (No test/default data created).',
    'In-Memory Fallback (Offline)',
  ];
  for (const line of lines) {
    let killed = false;
    assert.throws(
      () => superviseLogs({ kill() { killed = true; } }, line),
      (err) => err.code === 'E2E_API_ABORT',
      line,
    );
    assert.equal(killed, true, line);
  }
});

test('API env always pins the local database and never omits MONGODB_URI', () => {
  for (const base of [{}, { MONGODB_URI: '' }, { MONGODB_URI: '   ' }]) {
    const env = buildApiEnv(base);
    assert.equal(env.MONGODB_URI, ALLOWED_URI);
    assert.equal(env.PORT, '3100');
  }
});

test('spawn is not called when the URI is Atlas or a non-local database', () => {
  const blocked = [
    'mongodb+srv://user:fake@cluster0.example.mongodb.net/rebaroptima_e2e',
    'mongodb://127.0.0.1:27017/other_db',
    'mongodb://10.0.0.8:27017/rebaroptima_e2e',
  ];
  for (const MONGODB_URI of blocked) {
    let spawned = false;
    assert.throws(
      () => spawnGuardedApi({
        env: { MONGODB_URI },
        spawnImpl() { spawned = true; return { stdout: { on() {} }, stderr: { on() {} }, kill() {} }; },
      }),
      /Refusing/,
      MONGODB_URI,
    );
    assert.equal(spawned, false, MONGODB_URI);
  }
});

test('a local spawn watches logs and there is no success path after an abort', () => {
  const chunks = [];
  const child = {
    stdout: { on(event, fn) { if (event === 'data') chunks.push(fn); } },
    stderr: { on() {} },
    kill() { this.killed = true; },
    killed: false,
  };
  const { env } = spawnGuardedApi({
    env: { MONGODB_URI: ALLOWED_URI, VAPID_PRIVATE_KEY: 'must-not-pass-through' },
    spawnImpl() { return child; },
  });
  assert.equal(env.MONGODB_URI, ALLOWED_URI);
  assert.equal(env.VAPID_PRIVATE_KEY, undefined);
  assert.equal(chunks.length, 1);
  assert.throws(() => chunks[0]('Connected to MongoDB Atlas'), /E2E_API_ABORT|Connected to MongoDB Atlas/);
  assert.equal(child.killed, true);
});
