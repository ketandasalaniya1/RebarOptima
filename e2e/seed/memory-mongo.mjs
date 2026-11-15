/**
 * Test-only MongoDB. The process and its data are removed by stopMemoryMongo.
 * The URI is checked by the guard before anything else is allowed to use it.
 */
import net from 'node:net';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ALLOWED_DB, assertSafeMongoUri } from './guard.mjs';

export const MEMORY_MONGO_PORT = 27017;

export async function startMemoryMongo() {
  const server = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      dbName: ALLOWED_DB,
      ip: '127.0.0.1',
      name: 'testset',
    },
    instanceOpts: [{ port: MEMORY_MONGO_PORT, ip: '127.0.0.1' }],
  });
  try {
    const uri = assertSafeMongoUri(server.getUri(ALLOWED_DB)).uri;
    return { server, uri };
  } catch (err) {
    await server.stop({ doCleanup: true, force: true });
    throw err;
  }
}

export async function stopMemoryMongo(handle) {
  if (!handle?.server) return;
  await handle.server.stop({ doCleanup: true, force: true });
}

export function localPortOpen(port = MEMORY_MONGO_PORT) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
