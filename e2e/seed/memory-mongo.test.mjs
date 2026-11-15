import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSafeMongoUri } from './guard.mjs';
import { localPortOpen, startMemoryMongo, stopMemoryMongo } from './memory-mongo.mjs';

test('teardown stops the replica set and drops its port', async () => {
  const handle = await startMemoryMongo();
  try {
    const checked = assertSafeMongoUri(handle.uri);
    assert.equal(checked.host, '127.0.0.1');
    assert.equal(checked.db, 'rebaroptima_e2e');
    assert.match(handle.uri, /[?&]replicaSet=[A-Za-z0-9_-]+/);
    assert.equal(await localPortOpen(), true);
  } finally {
    await stopMemoryMongo(handle);
  }
  assert.equal(await localPortOpen(), false);
});
