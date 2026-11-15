/**
 * Starts the API only after the Mongo guard passes.
 * Test-only JWT values below are not production secrets.
 * Importing this file does not connect to a database and does not spawn the API.
 * Run it directly only after local Mongo is up: node e2e/start-api.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateLogChunk, resolveMongoUri } from './seed/guard.mjs';

const TEST_JWT_ACCESS = 'e2e-test-access-secret';
const TEST_JWT_REFRESH = 'e2e-test-refresh-secret';

export function buildApiEnv(base = {}) {
  const uri = resolveMongoUri(base);
  const env = { ...base, MONGODB_URI: uri, PORT: '3100' };
  env.JWT_ACCESS_SECRET = TEST_JWT_ACCESS;
  env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH;
  delete env.VAPID_PUBLIC_KEY;
  delete env.VAPID_PRIVATE_KEY;
  delete env.VAPID_SUBJECT;
  if (!env.MONGODB_URI) {
    throw new Error('Refusing to start the API without MONGODB_URI. In-memory fallback is forbidden.');
  }
  return env;
}

/**
 * Feed API output to the guard. On a forbidden log, kill the child and abort.
 * There is no branch that continues after an Atlas or in-memory log.
 */
export function superviseLogs(child, chunk) {
  const decision = evaluateLogChunk(chunk);
  if (!decision.abort) return decision;
  if (child && typeof child.kill === 'function') child.kill();
  const error = new Error(decision.reason);
  error.code = 'E2E_API_ABORT';
  throw error;
}

export function spawnGuardedApi({ env = process.env, spawnImpl = spawn, command = process.execPath, args = [] } = {}) {
  const safeEnv = buildApiEnv(env);
  const child = spawnImpl(command, args, { env: safeEnv });
  const onData = (buf) => superviseLogs(child, buf);
  child.stdout?.on?.('data', onData);
  child.stderr?.on?.('data', onData);
  return { child, env: safeEnv };
}

export function redactSecrets(text) {
  return String(text).replace(/mongodb(\+srv)?:\/\/[^/\s]+@/gi, 'mongodb$1://[redacted]@');
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend');
  const nestBin = path.join(backendDir, 'node_modules/@nestjs/cli/bin/nest.js');
  const safeEnv = buildApiEnv(process.env);
  const child = spawn(process.execPath, [nestBin, 'start'], { cwd: backendDir, env: safeEnv });
  let tail = '';
  const forward = (buf) => {
    const text = redactSecrets(buf);
    process.stdout.write(text);
    tail = (tail + text).slice(-8000);
    try {
      superviseLogs(child, tail);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      child.kill();
      process.exit(1);
    }
  };
  child.stdout?.on('data', forward);
  child.stderr?.on('data', forward);
  child.on('exit', (code) => process.exit(code ?? 1));
}
