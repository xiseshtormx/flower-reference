import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

// Не изменяет .env, пароль, товары или заявки.
// При успешной проверке создаёт и закрывает тестовую сессию.

let muted = false;

const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});

const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: Boolean(process.stdin.isTTY),
});

const report = (code, message) => {
  console.log('\n[' + code + '] ' + message);
};

async function main() {
  console.log(
    'Проверка входа в цветочную мастерскую. Пароль и хеш не выводятся.'
  );

  const envPath = resolve('.env');
  console.log('Папка проекта: ' + process.cwd());

  if (!existsSync(envPath)) {
    report(
      'NO_ENV',
      'В этой папке нет .env. Откройте терминал в папке сайта и выполните npm run setup.'
    );
    return;
  }

  const config = parseEnv(
    readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '')
  );

  const savedLogin = config.FLOWER_ADMIN_LOGIN;
  const savedHash = config.FLOWER_ADMIN_PASSWORD_HASH;

  if (
    !savedLogin ||
    !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(savedHash || '')
  ) {
    report(
      'INVALID_ENV',
      'В .env отсутствуют корректные настройки входа. Выполните npm run setup в этой папке.'
    );
    return;
  }

  console.log('Сохранённый логин: ' + JSON.stringify(savedLogin));

  for (const key of [
    'FLOWER_ADMIN_LOGIN',
    'FLOWER_ADMIN_PASSWORD_HASH',
  ]) {
    if (
      process.env[key] !== undefined &&
      process.env[key] !== config[key]
    ) {
      report(
        'ENV_OVERRIDE',
        'Переменная ' + key +
          ' в терминале отличается от .env и может перекрывать настройку файла.'
      );

      console.log(
        'Перед запуском сайта уберите только эту переменную: ' +
          'Remove-Item Env:' + key +
          ' -ErrorAction SilentlyContinue'
      );
    }
  }

  const login =
    (
      await prompt.question(
        'Логин, который вводите на сайте (Enter — сохранённый): '
      )
    ).trim() || savedLogin;

  process.stdout.write(
    'Тот же пароль, который вводите на сайте (ввод скрыт): '
  );

  muted = true;
  let password;

  try {
    password = await prompt.question('');
  } finally {
    muted = false;
    process.stdout.write('\n');
  }

  const loginMatches = login === savedLogin;
  let passwordMatches = false;

  if (password.length > 0 && password.length <= 200) {
    const [salt, digest] = savedHash.split(':');

    passwordMatches = timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(digest, 'hex')
    );
  }

  console.log(
    'Логин совпадает с .env: ' + (loginMatches ? 'ДА' : 'НЕТ')
  );

  console.log(
    'Пароль совпадает с .env: ' + (passwordMatches ? 'ДА' : 'НЕТ')
  );

  if (!loginMatches || !passwordMatches) {
    report(
      'LOCAL_MISMATCH',
      'Данные отличаются от сохранённых в этой папке. ' +
        'Если забыли пароль, остановите сервер, выполните npm run setup ' +
        'и перезапустите npm run dev.'
    );

    if (password !== password.trim()) {
      console.log(
        'Пароль содержит пробелы по краям. Они тоже учитываются при входе.'
      );
    }

    return;
  }

  report(
    'LOCAL_OK',
    'Логин и пароль верны для .env в этой папке. ' +
      'Теперь проверим запущенный сервер.'
  );

  const address =
    (
      await prompt.question(
        'Адрес сайта из терминала (Enter — http://localhost:4321): '
      )
    ).trim() || 'http://localhost:4321';

  let url;

  try {
    url = new URL(address);
  } catch {
    report(
      'INVALID_ADDRESS',
      'Укажите полный адрес, например http://localhost:4321'
    );
    return;
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    report(
      'LOCAL_ADDRESS_ONLY',
      'Эта проверка отправляет пароль только на localhost, ' +
        '127.0.0.1 или ::1. Укажите локальный адрес сайта.'
    );
    return;
  }

  let response;

  try {
    response = await fetch(
      new URL('/api/admin/login', url.origin),
      {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          Origin: url.origin,
        },
        body: JSON.stringify({ login, password }),
      }
    );
  } catch {
    report(
      'SERVER_UNREACHABLE',
      'Сервер по этому адресу не ответил. ' +
        'Проверьте адрес и порт в выводе npm run dev.'
    );
    return;
  } finally {
    password = '';
  }

  console.log('Ответ сервера: HTTP ' + response.status);

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    report(
      'SERVER_MISMATCH',
      'Пароль подходит к локальному .env, но сервер его отклонил. ' +
        'Сервер использует другие настройки или другую версию проекта.'
    );

    console.log(
      'Остановите сервер и запустите его из указанной выше папки: ' +
        'npm run dev -- --force'
    );
    return;
  }

  if (response.status === 503) {
    report(
      'SERVER_NO_ACCESS',
      'Сервер не загрузил настройки входа. ' +
        'Перезапустите npm run dev из папки, указанной выше.'
    );
    return;
  }

  if (response.status === 429) {
    report(
      'LOGIN_LIMIT',
      'Сработал лимит попыток входа. ' +
        'Подождите 15 минут и выполните проверку ещё раз.'
    );
    return;
  }

  if (response.status === 403) {
    report(
      'ORIGIN_MISMATCH',
      'Сервер отклонил адрес запроса. ' +
        'Проверьте адрес сайта и FLOWER_PUBLIC_ORIGIN в .env.'
    );
    return;
  }

  if (response.status !== 200 || data?.ok !== true) {
    report(
      'API_ERROR',
      'Ошибка маршрута API или конфигурации сервера. ' +
        'Пришлите этот результат и ошибку из терминала, без .env.'
    );
    return;
  }

  const cookie = response.headers
    .getSetCookie()
    .find(value => value.startsWith('flower_admin='))
    ?.split(';')[0];

  if (!cookie) {
    report(
      'NO_COOKIE',
      'Сервер принял пароль, но не вернул сессию входа.'
    );
    return;
  }

  let sessionValid = false;
  let sessionClosed = false;

  try {
    const session = await fetch(
      new URL('/api/admin/session', url.origin),
      {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: { Cookie: cookie },
      }
    );

    sessionValid =
      session.status === 200 &&
      (await session.json()).authenticated === true;
  } catch {
    // Куки и тело ответа не выводятся.
  } finally {
    try {
      const logout = await fetch(
        new URL('/api/admin/logout', url.origin),
        {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: {
            'Content-Type': 'application/json',
            Origin: url.origin,
            Cookie: cookie,
          },
          body: '{}',
        }
      );

      sessionClosed = logout.status === 200;
    } catch {
      // Сессия завершится по обычному сроку действия.
    }
  }

  report(
    sessionValid ? 'SERVER_OK' : 'SESSION_ERROR',
    sessionValid
      ? 'Сервер принял эти данные и создал рабочую сессию. ' +
          'Откройте /admin именно по проверенному адресу ' +
          'и введите те же данные вручную.'
      : 'Пароль принят, но сессия не прошла проверку. ' +
          'Пришлите этот результат.'
  );

  if (!sessionClosed) {
    report(
      'LOGOUT_FAILED',
      'Не удалось закрыть тестовую сессию. ' +
        'Она завершится по обычному сроку действия.'
    );
  }
}

try {
  await main();
} catch {
  muted = false;

  report(
    'CHECK_FAILED',
    'Не удалось закончить проверку. ' +
      'Проверьте Node.js (нужен 24.13 или новее) ' +
      'и запуск из папки проекта.'
  );

  process.exitCode = 1;
} finally {
  muted = false;
  prompt.close();
}