import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { database, resetConnections, publicCatalog, allProducts, shopConfig, getOrder } from '../src/server/database.ts';
import { createIntake, updateOrder } from '../src/server/orders.ts';
import { saveProduct, saveSettings } from '../src/server/catalog.ts';
import { HttpError, mutationGuard, readJSON } from '../src/server/http.ts';
import { defaultSettings } from '../src/lib/catalog-types.ts';
import { todayISO, shiftDate, productAvailable, availableSlots, isWorkingDate } from '../src/lib/availability.ts';
import { deliverNotifications, retryNotification } from '../src/server/notifications.ts';
import { uploadImage, serveImage } from '../src/server/media.ts';
import sharp from 'sharp';
import { authenticate, passwordHash } from '../src/server/auth.ts';

const directory = mkdtempSync(join(tmpdir(), 'flower-tests-'));
process.env.FLOWER_STORAGE_DIR = directory;
beforeEach(() => { resetConnections(); rmSync(directory, { recursive: true, force: true }); delete process.env.FLOWER_TELEGRAM_BOT_TOKEN; delete process.env.FLOWER_TELEGRAM_CHAT_ID; });
after(() => { resetConnections(); rmSync(directory, { recursive: true, force: true }); });
function checkout() {
  const catalog = publicCatalog();
  return { lines: [{ productId: 'pink-roses', size: 'M', quantity: 2, extras: ['vase'] }], date: shiftDate(todayISO(), 1), delivery: 'courier', timeSlot: '10:00–13:00',
    address: 'Тестовая улица, дом 1', buyerName: 'Тестовый покупатель', buyerPhone: '+7 999 123-45-67', selfRecipient: false, recipientName: 'Тестовый получатель', recipientPhone: '+7 999 111-22-33',
    comment: 'Тестовая открытка', consent: true, demoAcknowledged: true, website: '', expectedTotal: (catalog.products.find(p => p.id === 'pink-roses')!.prices.M + catalog.extras.find(e => e.id === 'vase')!.price) * 2 + catalog.settings.deliveryPrice };
}
const rejection = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;
const countOrders = () => Number(database().prepare('SELECT COUNT(*) AS count FROM orders').get()!.count);
const firstOrder = () => getOrder(1)!;

test('Сервер считает сумму из базы, игнорирует присланные цены и сохраняет снимок заказа', () => {
  const body = checkout(); Object.assign(body.lines[0], { price: 1, unitPrice: 1 });
  const receipt = createIntake('catalog', body, randomUUID());
  assert.equal(receipt.total, body.expectedTotal);
  assert.equal(firstOrder().data.lines![0].unitPrice, 4280);
  assert.equal(firstOrder().data.buyerPhone, '+79991234567');
  assert.equal(firstOrder().data.recipientPhone, '+79991112233');
  assert.equal(firstOrder().data.address, body.address);
  assert.equal(firstOrder().events.length, 1);
  const product = allProducts().find(p => p.id === 'pink-roses')!;
  saveProduct({ ...product, prices: { ...product.prices, M: 9999 }, name: 'Другое название' });
  assert.equal(firstOrder().data.lines![0].name, 'Розовые розы');
  assert.equal(firstOrder().total, body.expectedTotal);
  assert.throws(() => createIntake('catalog', { ...body, expectedTotal: 1 }, randomUUID()), rejection(409));
  assert.equal(countOrders(), 1);
});
test('Повтор запроса возвращает ту же заявку и не создаёт второй заказ или уведомление', () => {
  const body = checkout(); const key = randomUUID(); const first = createIntake('catalog', body, key);
  assert.deepEqual(createIntake('catalog', body, key), first);
  assert.equal(countOrders(), 1);
  assert.equal(database().prepare('SELECT COUNT(*) AS count FROM notifications').get()!.count, 1);
  assert.throws(() => createIntake('catalog', { ...body, comment: 'Другая заявка' }, key), rejection(409));
});
test('Скрытый букет и отключённое дополнение нельзя купить; редактирование проверяет версию', () => {
  const body = checkout(); const product = allProducts().find(p => p.id === 'pink-roses')!;
  saveProduct({ ...product, published: false });
  assert.ok(!publicCatalog().products.some(p => p.id === product.id));
  assert.throws(() => createIntake('catalog', body, randomUUID()), rejection(409));
  assert.throws(() => saveProduct({ ...product }), rejection(409));
  saveProduct({ ...allProducts().find(p => p.id === product.id)!, published: true });
  const config = shopConfig(); config.extras[1].enabled = false; saveSettings(config as unknown as Record<string, unknown>);
  assert.throws(() => createIntake('catalog', body, randomUUID()), rejection(409));
  assert.equal(countOrders(), 0);
});
test('Новые букеты и скрытый ассортимент переживают перезапуск базы', () => {
  const draft = { ...allProducts()[0], id: 'new-peonies', name: 'Новый букет', version: 0 };
  saveProduct(draft); assert.ok(publicCatalog().products.some(p => p.id === draft.id));
  for (const product of allProducts()) saveProduct({ ...product, published: false });
  resetConnections(); assert.equal(publicCatalog().products.length, 0); assert.equal(allProducts().length, 9);
});
test('Доступность учитывает часовой пояс Перми, подготовку, рабочие дни, горизонт и интервалы', () => {
  const now = new Date('2026-10-08T10:00:00+05:00'); const product = allProducts().find(p => p.id === 'pink-roses')!;
  assert.equal(todayISO(new Date('2026-10-07T20:00:00Z')), '2026-10-08');
  assert.equal(productAvailable(product, '2026-10-08', defaultSettings, now), true);
  assert.equal(productAvailable(product, '2026-10-08', defaultSettings, new Date('2026-10-08T16:00:00+05:00')), false);
  assert.deepEqual(availableSlots('2026-10-08', defaultSettings, new Date('2026-10-08T14:00:00+05:00')), ['16:00–19:00']);
  assert.equal(productAvailable({ ...product, availability: 'preorder', preparationDays: 3 }, '2026-10-10', defaultSettings, now), false);
  assert.equal(productAvailable({ ...product, availability: 'preorder', preparationDays: 3 }, '2026-10-11', defaultSettings, now), true);
  assert.equal(isWorkingDate('2026-11-15', defaultSettings, now), false);
  assert.equal(isWorkingDate('2026-02-31', defaultSettings, now), false);
  assert.equal(isWorkingDate('2026-10-08', { ...defaultSettings, workingDays: [1] }, now), false);
  assert.equal(isWorkingDate('2026-10-08', { ...defaultSettings, closedDates: ['2026-10-08'] }, now), false);
  assert.equal(productAvailable({ ...product, availability: 'unavailable' }, '', defaultSettings, now), false);
});
test('Дневной лимит, отмена и повтор отправки согласованы между собой', () => {
  const config = shopConfig(); config.settings.dailyCapacity = 1; saveSettings(config as unknown as Record<string, unknown>);
  const body = checkout(); const key = randomUUID(); const receipt = createIntake('catalog', body, key);
  assert.ok(publicCatalog().settings.closedDates.includes(body.date));
  assert.deepEqual(createIntake('catalog', body, key), receipt);
  assert.throws(() => createIntake('catalog', body, randomUUID()));
  updateOrder(1, { version: 1, status: 'cancelled', finalTotal: body.expectedTotal, note: 'Покупатель отменил' });
  assert.ok(!publicCatalog().settings.closedDates.includes(body.date));
  createIntake('catalog', body, randomUUID()); assert.equal(countOrders(), 2);
});
test('Индивидуальная заявка сохраняет контакт и бюджет, требует согласованной суммы при подтверждении', () => {
  const body = { buyerName: 'Тест', contactMethod: 'telegram', contact: '@test_user', date: shiftDate(todayISO(), 2), budget: 4500, comment: 'Без роз', consent: true, demoAcknowledged: true };
  const result = createIntake('custom', body, randomUUID()); assert.equal(result.total, null);
  assert.equal(firstOrder().data.contact, '@test_user');
  assert.throws(() => updateOrder(1, { version: 1, status: 'confirmed', finalTotal: null, note: 'Согласовано' }), rejection(400));
  const updated = updateOrder(1, { version: 1, status: 'confirmed', finalTotal: 4200, note: 'Согласованы пионы и упаковка' });
  assert.equal(updated.finalTotal, 4200); assert.equal(updated.events.length, 2);
  assert.throws(() => updateOrder(1, { version: 1, status: 'preparing', finalTotal: 4200, note: '' }), rejection(409));
});
test('Нельзя пропускать этапы, отменять без причины или менять завершённый заказ', () => {
  const body = checkout(); createIntake('catalog', body, randomUUID());
  assert.throws(() => updateOrder(1, { version: 1, status: 'completed', finalTotal: body.expectedTotal, note: '' }), rejection(400));
  assert.throws(() => updateOrder(1, { version: 1, status: 'cancelled', finalTotal: body.expectedTotal, note: '' }), rejection(400));
  let order = updateOrder(1, { version: 1, status: 'confirmed', finalTotal: body.expectedTotal, note: '' });
  order = updateOrder(1, { version: order.version, status: 'preparing', finalTotal: body.expectedTotal, note: '' });
  order = updateOrder(1, { version: order.version, status: 'completed', finalTotal: body.expectedTotal, note: '' });
  assert.throws(() => updateOrder(1, { version: order.version, status: 'completed', finalTotal: 200, note: 'Изменить' }), rejection(400));
  resetConnections(); assert.equal(getOrder(1)!.events.length, 4);
});
test('Формы проверяют контакты, согласие, тестовый режим, размеры и повторные дополнения', () => {
  const body = checkout();
  for (const patch of [{ buyerPhone: '12345' }, { consent: false }, { demoAcknowledged: false }, { website: 'spam' }, { recipientPhone: '+7badnumber' }]) assert.throws(() => createIntake('catalog', { ...body, ...patch }, randomUUID()), rejection(400));
  for (const line of [{ ...body.lines[0], size: 'XL' }, { ...body.lines[0], quantity: 0 }, { ...body.lines[0], extras: ['vase', 'vase'] }]) assert.throws(() => createIntake('catalog', { ...body, lines: [line] }, randomUUID()), rejection(400));
  assert.equal(countOrders(), 0);
});
test('Управление каталогом проверяет изображения, цены и устаревшие настройки', () => {
  const product = allProducts()[0];
  for (const patch of [{ images: ['https://example.com/picture.jpg'] }, { imagePosition: '50%;color:red' }, { prices: { S: -1, M: 2000, L: 4000 } }, { id: '../escape' }]) assert.throws(() => saveProduct({ ...product, ...patch }), rejection(400));
  const config = shopConfig(); saveSettings(config as unknown as Record<string, unknown>);
  assert.throws(() => saveSettings(config as unknown as Record<string, unknown>), rejection(409));
});
test('CSRF и размер запроса проверяются до чтения и записи данных', async () => {
  assert.throws(() => mutationGuard(new Request('http://localhost:4321/api/orders', { method: 'POST', headers: { Origin: 'https://other.example' } })), rejection(403));
  mutationGuard(new Request('http://localhost:4321/api/orders', { method: 'POST', headers: { Origin: 'http://localhost:4321' } }));
  await assert.rejects(readJSON(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(64001) })), rejection(413));
});
test('Неудачное уведомление не теряет заказ; повторная доставка не содержит контакты', async () => {
  const body = checkout(); createIntake('catalog', body, randomUUID());
  process.env.FLOWER_TELEGRAM_BOT_TOKEN = 'test'; process.env.FLOWER_TELEGRAM_CHAT_ID = 'test';
  await deliverNotifications((async () => { throw new Error('Offline'); }) as typeof fetch);
  assert.equal(countOrders(), 1); assert.equal(firstOrder().notification!.state, 'pending');
  retryNotification(1); let sent = '';
  await deliverNotifications((async (_url, init) => { sent = String(init?.body); return new Response('{"ok":true}', { status: 200 }); }) as typeof fetch);
  assert.equal(firstOrder().notification!.state, 'sent');
  assert.ok(!sent.includes('79991234567')); assert.ok(!sent.includes(body.address)); assert.ok(sent.includes('FL-000001'));
});
test('Загрузка нормализует фото, сохраняет его после перезапуска и отвергает SVG', async () => {
  const source = await sharp({ create: { width: 32, height: 40, channels: 3, background: '#fff' } }).png().toBuffer();
  const result = await uploadImage(new Request('http://localhost', { method: 'POST', body: new Uint8Array(source) }));
  resetConnections(); const response = await serveImage(result.image.split('/').pop());
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp');
  await assert.rejects(uploadImage(new Request('http://localhost', { method: 'POST', body: '<svg></svg>' })), rejection(400));
  assert.equal((await serveImage('../flower.sqlite')).status, 404);
});

test('Пароль сохраняет значимые пробелы; неверный пароль не открывает панель', () => {
  process.env.FLOWER_ADMIN_LOGIN = 'test-owner';
  const password = '  Test-password-1234  ';
  process.env.FLOWER_ADMIN_PASSWORD_HASH = passwordHash(password);
  assert.equal(authenticate('test-owner', password), true);
  assert.throws(() => authenticate('test-owner', password.trim()), rejection(401));
  delete process.env.FLOWER_ADMIN_LOGIN; delete process.env.FLOWER_ADMIN_PASSWORD_HASH;
});
