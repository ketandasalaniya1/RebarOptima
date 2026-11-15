import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { assertSafeMongoUri } from './guard.mjs';

const MARKER = 'e2e-password-hash-unchanged';
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('a restart leaves an existing platform password and isActive unchanged', { timeout: 180000 }, async () => {
  const uri = assertSafeMongoUri(fs.readFileSync(path.join(repoDir, 'e2e/.run-uri'), 'utf8').trim()).uri;
  const env = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    TMPDIR: process.env.TMPDIR || '/tmp',
    MONGODB_URI: uri,
    PORT: '3101',
    E2E_SKIP_DOTENV: '1',
    JWT_ACCESS_SECRET: 'e2e-test-access-secret',
    JWT_REFRESH_SECRET: 'e2e-test-refresh-secret',
    DEVELOPER_EMAIL: 'dev@gmail.com',
    DEVELOPER_PASSWORD: 'e2e-developer-password',
    SUPERADMIN_EMAIL: 'superadmin@rebaroptima.io',
    SUPERADMIN_PASSWORD: 'e2e-superadmin-password',
  };
  const emails = [env.DEVELOPER_EMAIL, env.SUPERADMIN_EMAIL];
  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db('rebaroptima_e2e').collection('platformusers');
  try {
    for (const email of emails) {
      await users.updateOne(
        { email },
        {
          $set: { passwordHash: MARKER, isActive: false },
          $setOnInsert: {
            email,
            role: email === env.DEVELOPER_EMAIL ? 'DEVELOPER' : 'SUPER_ADMIN',
            firstName: 'E2E',
            lastName: 'Probe',
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    const child = spawn(process.execPath, [path.join(repoDir, 'node_modules/@nestjs/cli/bin/nest.js'), 'start'], {
      cwd: path.join(repoDir, 'backend'),
      env,
      detached: true,
    });
    let log = '';
    let settled = false;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('API seed did not finish')), 150000);
        const finish = (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) reject(err);
          else resolve();
        };
        const onData = (buf) => {
          log += buf.toString();
          if (log.includes('seeded/synced successfully')) finish();
          else if (log.includes('MongoDB seed error')) finish(new Error('MongoDB seed error'));
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('exit', (code) => {
          if (!settled) finish(new Error(`API exited ${code} before seed`));
        });
      });
    } finally {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
    }

    for (const email of emails) {
      const doc = await users.findOne({ email });
      assert.equal(doc.passwordHash, MARKER);
      assert.equal(doc.isActive, false);
    }
  } finally {
    await client.close();
  }
});
