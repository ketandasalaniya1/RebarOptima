/**
 * Starts the API only after the Mongo guard passes.
 * Test-only JWT values below are not production secrets.
 * Importing this file does not connect to a database and does not spawn the API.
 * Run it directly only after local Mongo is up: node e2e/start-api.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateLogChunk, resolveMongoUri, assertSafeMongoUri } from './seed/guard.mjs';
import { startMemoryMongo, stopMemoryMongo } from './seed/memory-mongo.mjs';

const TEST_JWT_ACCESS = 'e2e-test-access-secret';
const TEST_JWT_REFRESH = 'e2e-test-refresh-secret';
const TEST_DEVELOPER_EMAIL = 'dev@gmail.com';
const TEST_DEVELOPER_PASSWORD = 'e2e-developer-password';
const TEST_SUPERADMIN_EMAIL = 'superadmin@rebaroptima.io';
const TEST_SUPERADMIN_PASSWORD = 'e2e-superadmin-password';

export function buildApiEnv(base = {}) {
  const uri = resolveMongoUri(base);
  const env = { ...base, MONGODB_URI: uri, PORT: '3100', E2E_SKIP_DOTENV: '1' };
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

const FORBIDDEN_ENV_TEXT = ['mongodb.net', 'mongodb+srv', 'cluster0.aghjxtj.mongodb.net'];

/** Env passed to the API. Does not copy the parent environment or backend/.env. */
export function buildCleanApiEnv(mongoUri) {
  const checked = assertSafeMongoUri(mongoUri);
  return {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    TMPDIR: process.env.TMPDIR || '/tmp',
    MONGODB_URI: checked.uri,
    PORT: '3100',
    E2E_SKIP_DOTENV: '1',
    JWT_ACCESS_SECRET: TEST_JWT_ACCESS,
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH,
    DEVELOPER_EMAIL: TEST_DEVELOPER_EMAIL,
    DEVELOPER_PASSWORD: TEST_DEVELOPER_PASSWORD,
    SUPERADMIN_EMAIL: TEST_SUPERADMIN_EMAIL,
    SUPERADMIN_PASSWORD: TEST_SUPERADMIN_PASSWORD,
  };
}

export function reportEnv(env) {
  const names = Object.keys(env).sort();
  const atlasHostnamePresent = Object.values(env).some((value) => {
    const text = String(value).toLowerCase();
    return FORBIDDEN_ENV_TEXT.some((item) => text.includes(item));
  });
  return { names, atlasHostnamePresent };
}

export function redactSecrets(text) {
  return String(text).replace(/mongodb(\+srv)?:\/\/[^/\s]+@/gi, 'mongodb$1://[redacted]@');
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

async function runGuardedStack() {
  const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const backendDir = path.join(repoDir, 'backend');
  const frontendDir = path.join(repoDir, 'frontend');
  const memory = await startMemoryMongo();
  const safeEnv = buildCleanApiEnv(memory.uri);
  const report = reportEnv(safeEnv);
  if (report.atlasHostnamePresent) {
    await stopMemoryMongo(memory);
    throw new Error('Refusing to start. An Atlas hostname is present in the API environment.');
  }
  process.stdout.write(`API_ENV_NAMES=${report.names.join(',')}\n`);
  process.stdout.write('ATLAS_HOSTNAME_IN_ENV=no\n');
  fs.writeFileSync(path.join(repoDir, 'e2e/.run-uri'), `${safeEnv.MONGODB_URI}\n`, { mode: 0o600 });

  const api = spawn(process.execPath, [path.join(repoDir, 'node_modules/@nestjs/cli/bin/nest.js'), 'start'], {
    cwd: backendDir,
    env: safeEnv,
  });
  const web = spawn(process.execPath, [
    path.join(repoDir, 'node_modules/vite/bin/vite.js'),
    '--port', '5174',
    '--host', '127.0.0.1',
    '--strictPort',
  ], {
    cwd: frontendDir,
    env: {
      PATH: safeEnv.PATH,
      HOME: safeEnv.HOME,
      TMPDIR: safeEnv.TMPDIR,
      VITE_API_URL: 'http://127.0.0.1:3100/api',
    },
  });

  const uriFile = path.join(repoDir, 'e2e/.run-uri');
  const shutdown = async (code) => {
    api.kill();
    web.kill();
    await stopMemoryMongo(memory);
    fs.rmSync(uriFile, { force: true });
    process.exit(code);
  };
  let tail = '';
  const forward = (buf) => {
    const text = redactSecrets(buf);
    process.stdout.write(text);
    tail = (tail + text).slice(-8000);
    try {
      superviseLogs(api, tail);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      shutdown(1);
    }
  };
  api.stdout?.on('data', forward);
  api.stderr?.on('data', forward);
  web.stdout?.on('data', (buf) => process.stdout.write(redactSecrets(buf)));
  web.stderr?.on('data', (buf) => process.stdout.write(redactSecrets(buf)));
  api.on('exit', () => shutdown(1));
}

if (isDirectRun()) {
  runGuardedStack().catch(async (err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
