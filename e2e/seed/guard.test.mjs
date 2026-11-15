import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSafeMongoUri, ALLOWED_URI, evaluateLogChunk, resolveMongoUri } from './guard.mjs';

test('refuses an Atlas mongodb+srv URI', () => {
  assert.throws(
    () => assertSafeMongoUri('mongodb+srv://user:fake@cluster0.example.mongodb.net/rebaroptima_e2e'),
    /mongodb\+srv/,
  );
});

test('refuses a mongodb.net host even on the allowed database name', () => {
  assert.throws(
    () => assertSafeMongoUri('mongodb://user:fake@cluster0.example.mongodb.net/rebaroptima_e2e'),
    /mongodb\.net/,
  );
});

test('refuses a database name other than rebaroptima_e2e', () => {
  for (const uri of [
    'mongodb://127.0.0.1:27017/rebaroptima',
    'mongodb://127.0.0.1:27017/test',
    'mongodb://127.0.0.1:27017/admin',
    'mongodb://localhost:27017/rebar_optima',
    'mongodb://127.0.0.1:27017/',
  ]) {
    assert.throws(() => assertSafeMongoUri(uri), /Refusing database/, uri);
  }
});

test('refuses a host other than 127.0.0.1 or localhost', () => {
  for (const uri of [
    'mongodb://10.0.0.5:27017/rebaroptima_e2e',
    'mongodb://0.0.0.0:27017/rebaroptima_e2e',
    'mongodb://mongo:27017/rebaroptima_e2e',
    'mongodb://example.com:27017/rebaroptima_e2e',
  ]) {
    assert.throws(() => assertSafeMongoUri(uri), /Refusing host/, uri);
  }
});

test('accepts a local single-node replica set URI', () => {
  const uri = 'mongodb://127.0.0.1:27017/rebaroptima_e2e?replicaSet=testset&directConnection=true';
  assert.deepEqual(assertSafeMongoUri(uri), {
    uri,
    host: '127.0.0.1',
    db: 'rebaroptima_e2e',
  });
});

test('refuses replica set URIs that add hosts or other query parameters', () => {
  assert.throws(
    () => assertSafeMongoUri('mongodb://127.0.0.1:27017/rebaroptima_e2e?authSource=admin'),
    /query parameter/,
  );
  assert.throws(
    () => assertSafeMongoUri('mongodb://127.0.0.1:27017/rebaroptima_e2e?replicaSet=cluster0.example.mongodb.net'),
    /mongodb\.net/,
  );
  assert.throws(
    () => assertSafeMongoUri('mongodb://127.0.0.1:27017,10.0.0.8:27018/rebaroptima_e2e?replicaSet=testset'),
    /multiple Mongo hosts/,
  );
});

test('accepts only the local rebaroptima_e2e database', () => {
  assert.deepEqual(assertSafeMongoUri(ALLOWED_URI), {
    uri: ALLOWED_URI,
    host: '127.0.0.1',
    db: 'rebaroptima_e2e',
  });
  assert.equal(
    assertSafeMongoUri('mongodb://localhost:27017/rebaroptima_e2e').db,
    'rebaroptima_e2e',
  );
});

test('a local rebaroptima_e2e connection log is allowed', () => {
  assert.deepEqual(
    evaluateLogChunk('✅ Connected to MongoDB (127.0.0.1/rebaroptima_e2e)\n'),
    { abort: false },
  );
  assert.deepEqual(
    evaluateLogChunk('✅ Connected to MongoDB (localhost/rebaroptima_e2e)\n'),
    { abort: false },
  );
});

test('a connection log aborts for mongodb.net, Atlas, another host, or another database', () => {
  const refused = [
    '✅ Connected to MongoDB Atlas (cluster0.example.mongodb.net/rebaroptima_e2e)',
    '✅ Connected to MongoDB (cluster0.example.mongodb.net/rebaroptima_e2e)',
    '✅ Connected to MongoDB (10.0.0.5/rebaroptima_e2e)',
    '✅ Connected to MongoDB (127.0.0.1/other_db)',
    '✅ Connected to MongoDB Atlas',
  ];
  for (const line of refused) {
    const decision = evaluateLogChunk(line);
    assert.equal(decision.abort, true, line);
  }
});

test('an empty URI is refused instead of being treated as an in-memory fallback', () => {
  assert.throws(() => assertSafeMongoUri(''), /in-memory/i);
  assert.throws(() => assertSafeMongoUri('   '), /in-memory/i);
  assert.equal(resolveMongoUri({}), ALLOWED_URI);
  assert.equal(resolveMongoUri({ MONGODB_URI: '' }), ALLOWED_URI);
  assert.throws(
    () => resolveMongoUri({ MONGODB_URI: 'mongodb+srv://user:fake@cluster0.example.mongodb.net/test' }),
    /mongodb\+srv/,
  );
});
