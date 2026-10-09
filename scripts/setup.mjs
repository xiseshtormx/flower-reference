import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { passwordHash } from '../src/server/auth.ts';
import { database } from '../src/server/database.ts';

let muted = false;
const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
try {
  console.log('Настройка доступа к панели цветочной мастерской.');
  const login = (await prompt.question('Логин (латиница и цифры): ')).trim();
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(login)) throw new Error('Логин: от 3 до 80 латинских букв, цифр или символов _ . -');
  process.stdout.write('Пароль (от 12 символов, ввод скрыт): '); muted = true;
  const password = await prompt.question(''); muted = false; process.stdout.write('\n');
  if (password.length < 12 || password.length > 200) throw new Error('Пароль должен содержать от 12 до 200 символов.');
  process.stdout.write('Повторите пароль: '); muted = true;
  const confirmation = await prompt.question(''); muted = false; process.stdout.write('\n');
  if (password !== confirmation) throw new Error('Пароли не совпали. Запустите настройку ещё раз.');
  const updates = { FLOWER_ADMIN_LOGIN: login, FLOWER_ADMIN_PASSWORD_HASH: passwordHash(password) };
  const previous = existsSync('.env') ? readFileSync('.env', 'utf8') : '# Настройки цветочной мастерской. Не публикуйте этот файл.\nFLOWER_STORAGE_DIR=./storage\n# FLOWER_TELEGRAM_BOT_TOKEN=\n# FLOWER_TELEGRAM_CHAT_ID=\n';
  const lines = previous.split(/\r?\n/).filter(line => !Object.keys(updates).some(key => line.startsWith(key + '=')));
  for (const [key, value] of Object.entries(updates)) lines.push(key + '=' + JSON.stringify(value));
  writeFileSync('.env.setup.tmp', lines.join('\n') + '\n', { mode: 0o600 }); renameSync('.env.setup.tmp', '.env');
  database().prepare('DELETE FROM sessions').run();
  database().prepare("DELETE FROM rate_limits WHERE key LIKE 'login:%'").run();
  console.log('Готово. Запустите npm run dev и откройте http://localhost:4321/admin');
  console.log('Повторная настройка меняет пароль и завершает предыдущие сессии. Товары и заявки сохраняются.');
} catch (error) { muted = false; console.error(error.message); process.exitCode = 1; }
finally { prompt.close(); }
