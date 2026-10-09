import type { APIContext } from 'astro';
import { handle, json, HttpError, mutationGuard, readJSON, rateLimit, clientKey } from '../../server/http.ts';
import { publicCatalog, allProducts, shopConfig, database, getOrder } from '../../server/database.ts';
import { loggedIn, requireAdmin, authenticate, createSession, endSession } from '../../server/auth.ts';
import { saveProduct, saveSettings } from '../../server/catalog.ts';
import { createIntake, updateOrder } from '../../server/orders.ts';
import { uploadImage } from '../../server/media.ts';
import { telegramConfigured, deliverNotifications, retryNotification } from '../../server/notifications.ts';

export const prerender = false;
async function route(context: APIContext) {
  const { request, params, url } = context; const path = params.path || ''; const method = request.method;
  if (method !== 'GET') mutationGuard(request);
  if (method === 'GET' && path === 'catalog') return publicCatalog();
  if (path === 'admin/session' && method === 'GET') return { authenticated: loggedIn(context) };
  if (path === 'admin/login' && method === 'POST') {
    rateLimit('login:' + clientKey(context), 8, 15 * 60000);
    rateLimit('login:global', 200, 15 * 60000);
    const body = await readJSON(request); authenticate(body.login, body.password); createSession(context); return { ok: true };
  }
  if (path === 'admin/logout' && method === 'POST') { endSession(context); return { ok: true }; }
  if (method === 'POST' && (path === 'orders' || path === 'requests')) {
    rateLimit('form:' + clientKey(context), 60, 10 * 60000);
    const result = createIntake(path === 'orders' ? 'catalog' : 'custom', await readJSON(request), request.headers.get('Idempotency-Key'), clientKey(context));
    void deliverNotifications().catch(() => {}); return json(result, 201);
  }
  if (!path.startsWith('admin/')) throw new HttpError(404, 'Адрес не найден.');
  requireAdmin(context);
  if (path === 'admin/bootstrap' && method === 'GET') {
    void deliverNotifications().catch(() => {});
    return { products: allProducts(), ...shopConfig(), telegramConfigured: telegramConfigured() };
  }
  if (path === 'admin/products' && method === 'PUT') return { product: saveProduct(await readJSON(request)) };
  if (path === 'admin/settings' && method === 'PUT') return saveSettings(await readJSON(request));
  if (path === 'admin/upload' && method === 'POST') { rateLimit('upload', 60, 3600000); return uploadImage(request); }
  if (path === 'admin/orders' && method === 'GET') {
    const conditions: string[] = []; const args: (string | number)[] = [];
    if (url.searchParams.get('status')) { conditions.push('status=?'); args.push(url.searchParams.get('status')!); }
    if (url.searchParams.get('kind')) { conditions.push('kind=?'); args.push(url.searchParams.get('kind')!); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)));
    const db = database(); const count = Number(db.prepare('SELECT COUNT(*) AS count FROM orders' + where).get(...args)!.count);
    const rows = db.prepare('SELECT id FROM orders' + where + ' ORDER BY id DESC LIMIT 25 OFFSET ?').all(...args, (page - 1) * 25);
    const counts = db.prepare('SELECT status,COUNT(*) AS count FROM orders GROUP BY status').all();
    void deliverNotifications().catch(() => {});
    return { orders: rows.map(row => getOrder(Number(row.id))), count, page, pages: Math.max(1, Math.ceil(count / 25)), counts };
  }
  const match = /^admin\/orders\/(\d+)(\/notification)?$/.exec(path);
  if (match) {
    const id = Number(match[1]); if (!Number.isSafeInteger(id)) throw new HttpError(404, 'Заказ не найден.');
    if (match[2] && method === 'POST') { retryNotification(id); void deliverNotifications().catch(() => {}); return { ok: true }; }
    if (!match[2] && method === 'PATCH') return { order: updateOrder(id, await readJSON(request)) };
    if (!match[2] && method === 'GET') { const order = getOrder(id); if (!order) throw new HttpError(404, 'Заказ не найден.'); return { order }; }
  }
  throw new HttpError(404, 'Адрес не найден.');
}
export const ALL = (context: APIContext) => handle(() => route(context));
