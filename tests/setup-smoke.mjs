import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'flower-setup-'));
const setupScript = resolve('scripts/setup.mjs');
const backupScript = resolve('scripts/backup.mjs');
let output = '';
try {
  await new Promise((resolveDone, reject) => {
    const child = spawn(process.execPath, [setupScript], { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Setup timeout')); }, 5000);
    let loginSent = false, passwordSent = false, confirmationSent = false;
    child.stdout.on('data', bytes => {
      output += bytes;
      if (!loginSent && output.includes('Логин (')) { loginSent = true; child.stdin.write('test-owner\n'); }
      if (!passwordSent && output.includes('Пароль (')) { passwordSent = true; child.stdin.write('Test-password-1234\n'); }
      if (!confirmationSent && output.includes('Повторите пароль:')) { confirmationSent = true; child.stdin.write('Test-password-1234\n'); }
    });
    child.stderr.on('data', bytes => { output += bytes; });
    child.on('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error(output)); else resolveDone(); });
  });
  const envFile = await readFile(join(directory, '.env'), 'utf8');
  assert.ok(envFile.includes('FLOWER_ADMIN_PASSWORD_HASH=')); assert.ok(!envFile.includes('Test-password-1234'));
  await new Promise((resolveDone, reject) => {
    const child = spawn(process.execPath, ['--env-file-if-exists=.env', backupScript], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] }); let logs = '';
    child.stdout.on('data', bytes => { logs += bytes; }); child.stderr.on('data', bytes => { logs += bytes; });
    child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(logs)));
  });
  const backups = await readdir(join(directory, 'storage/backups')); assert.equal(backups.length, 1);
  assert.ok((await readdir(join(directory, 'storage/backups', backups[0]))).includes('flower.sqlite'));
  console.log('Настройка пароля и резервное копирование проверены.');
} finally { await rm(directory, { recursive: true, force: true }); }
