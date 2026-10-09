// npm run build && npm run test:integration
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID, scryptSync } from 'node:crypto';
import sharp from 'sharp';
const storage = await mkdtemp(join(tmpdir(), 'flower-http-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = 'http://127.0.0.1:' + port;
const salt = 'a'.repeat(32); const password = 'Test-only-password-123';
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), FLOWER_STORAGE_DIR: storage, FLOWER_ADMIN_LOGIN: 'test-admin', FLOWER_ADMIN_PASSWORD_HASH: salt + ':' + scryptSync(password, salt, 64).toString('hex') };
for (const key of ['FLOWER_TELEGRAM_BOT_TOKEN','FLOWER_TELEGRAM_CHAT_ID','FLOWER_PUBLIC_ORIGIN','FLOWER_COOKIE_SECURE','FLOWER_TRUST_PROXY']) delete env[key];
let child; let cookie = ''; let serverLog = ''; let checks = 0;
const ok = message => { checks++; console.log('✓ ' + message); };
async function request(path, method = 'GET', body, headers = {}) {
  return fetch(origin + path, { method, headers: { ...(method === 'GET' ? {} : { Origin: origin }), ...(body === undefined || body instanceof Uint8Array ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body), redirect: 'manual' });
}
async function api(path, method = 'GET', body, headers = {}) {
  const response = await request('/api/' + path, method, body, headers); const data = await response.json();
  assert.ok(response.ok, path + ': ' + response.status + ' ' + JSON.stringify(data)); return data;
}
async function start() {
  child = spawn(process.execPath, ['dist/server/entry.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', bytes => { serverLog += bytes; }); child.stderr.on('data', bytes => { serverLog += bytes; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Server exited: ' + serverLog);
    try { const response = await request('/api/catalog'); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Server did not start: ' + serverLog);
}
async function stop() { if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); } }
try {
  await start(); let catalog = await api('catalog'); assert.equal(catalog.products.length, 8);
  for (const path of ['/', '/cart/', '/bouquet/pink-roses/', '/privacy/', '/admin']) {
    const response = await request(path); const html = await response.text(); assert.equal(response.status, 200, path + ' ' + html.slice(0, 800));
    const urls = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:css|js|mjs)(?:\?[^"\s]*)?)"/g)].map(match => match[1]);
    for (const url of urls) if (url.startsWith('/')) assert.equal((await request(url)).status, 200, url);
  }
  ok('Страницы и все подключённые CSS/JS доступны в производственной сборке');
  assert.equal((await request('/bouquet/does-not-exist/')).status, 404); ok('Неизвестный букет возвращает 404');
  assert.equal((await request('/api/admin/bootstrap')).status, 401);
  assert.equal((await request('/api/admin/products', 'PUT', {})).status, 401); ok('Без входа нельзя читать панель или менять ассортимент');
  assert.equal((await request('/api/admin/login', 'POST', { login: 'test-admin', password: 'wrong' })).status, 401);
  const login = await request('/api/admin/login', 'POST', { login: 'test-admin', password }); assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie'); assert.ok(setCookie.includes('HttpOnly')); assert.ok(setCookie.includes('SameSite=Strict')); cookie = setCookie.split(';')[0];
  const bootstrap = await api('admin/bootstrap'); assert.equal(bootstrap.products.length, 8); ok('Вход создаёт HttpOnly-сессию и открывает панель');
  const bytes = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#b69cad' } }).jpeg().toBuffer();
  const photo = await api('admin/upload', 'POST', new Uint8Array(bytes), { 'Content-Type': 'image/jpeg' });
  assert.equal((await request(photo.image)).status, 200);
  const product = { ...bootstrap.products[0], id: 'http-new-bouquet', name: 'Новый тестовый букет', images: [photo.image], version: 0 };
  const saved = await api('admin/products', 'PUT', product);
  const page = await request('/bouquet/http-new-bouquet/'); assert.equal(page.status, 200); assert.ok((await page.text()).includes(product.name));
  catalog = await api('catalog'); assert.ok(catalog.products.some(p => p.id === product.id)); ok('Загруженное фото и новая карточка появляются без пересборки');
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const body = { lines: [{ productId: product.id, size: 'M', quantity: 1, extras: [] }], date, delivery: 'pickup', timeSlot: '10:00–13:00', buyerName: 'Тестовый покупатель', buyerPhone: '+7 999 123-45-67', selfRecipient: true, comment: 'HTTP-проверка', expectedTotal: product.prices.M, consent: true, demoAcknowledged: true };
  const key = randomUUID(); const result = await api('orders', 'POST', body, { 'Idempotency-Key': key });
  assert.deepEqual(await api('orders', 'POST', body, { 'Idempotency-Key': key }), result);
  let orders = await api('admin/orders'); assert.equal(orders.count, 1); assert.equal(orders.orders[0].data.comment, body.comment); ok('Корзина сохраняет заявку; повторный запрос не создаёт дубль');
  const modified = await api('admin/products', 'PUT', { ...saved.product, prices: { ...saved.product.prices, M: product.prices.M + 1000 } });
  assert.equal((await request('/api/orders', 'POST', body, { 'Idempotency-Key': randomUUID() })).status, 409);
  const freshPage = await request('/bouquet/' + product.id + '/'); assert.ok((await freshPage.text()).includes(String(product.prices.M + 1000))); ok('Изменённые цены сразу видны; устаревшую сумму сервер отклоняет');
  await api('admin/products', 'PUT', { ...modified.product, published: false }); assert.equal((await request('/bouquet/' + product.id + '/')).status, 404); ok('Скрытый букет исчезает из каталога и его публичная карточка закрывается');
  const custom = await api('requests', 'POST', { buyerName: 'Тестовый контакт', contactMethod: 'telegram', contact: '@test_user', budget: 5000, date, comment: 'Светлый букет', consent: true, demoAcknowledged: true }, { 'Idempotency-Key': randomUUID() });
  assert.ok(custom.number); orders = await api('admin/orders'); assert.equal(orders.count, 2); ok('Индивидуальные пожелания попадают в тот же журнал');
  const record = orders.orders.find(order => order.kind === 'catalog');
  const confirmed = await api('admin/orders/' + record.id, 'PATCH', { version: record.version, status: 'confirmed', finalTotal: record.total, note: 'Согласовано' });
  assert.equal(confirmed.order.status, 'confirmed'); assert.equal(confirmed.order.events.length, 2); ok('Подтверждение заказа сохраняет статус, сумму и историю');
  const evil = await fetch(origin + '/api/admin/settings', { method: 'PUT', headers: { Cookie: cookie, Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: JSON.stringify(bootstrap) }); assert.equal(evil.status, 403); ok('Изменения с постороннего сайта блокируются');
  const publicData = JSON.stringify(await api('catalog')); assert.ok(!publicData.includes(body.buyerName)); assert.ok(!publicData.includes('79991234567')); ok('Публичный каталог не раскрывает контакты покупателей');
  await stop(); await start(); orders = await api('admin/orders'); assert.equal(orders.count, 2); assert.equal(orders.orders.find(order => order.id === record.id).status, 'confirmed'); assert.equal((await request(photo.image)).status, 200); ok('Заказы, изменения и фото сохраняются после перезапуска');
  await api('admin/logout', 'POST', {}); assert.equal((await request('/api/admin/orders')).status, 401); ok('Выход закрывает доступ к приватным данным');
  console.log(`${checks} HTTP-проверок пройдено.`);
} finally { await stop(); await rm(storage, { recursive: true, force: true }); }
