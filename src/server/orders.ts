import { createHash } from 'node:crypto';
import { database, transaction, publicCatalog, shopConfig, bookingsOn, getOrder } from './database.ts';
import { HttpError, object, text, phone, integer, intakeChecks, rateLimit } from './http.ts';
import { productAvailable, isWorkingDate, availableSlots } from '../lib/availability.ts';
import { nextStatuses, type OrderRecord, type OrderStatus, type Size } from '../lib/catalog-types.ts';

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function receipt(order: OrderRecord) { return { number: order.number, total: order.total, date: order.date, demo: order.data.demo }; }
export function createIntake(kind: 'catalog' | 'custom', body: Record<string, unknown>, key: string | null, client = 'local') {
  if (!key || !/^[a-f0-9-]{36}$/i.test(key)) throw new HttpError(400, 'Обновите страницу и отправьте форму снова.');
  const hash = createHash('sha256').update(kind + ':' + stable(body)).digest('hex');
  const db = database();
  return transaction(db, () => {
    const existing = db.prepare('SELECT id,body_hash FROM orders WHERE idempotency_key=?').get(key);
    if (existing) {
      if (existing.body_hash !== hash) throw new HttpError(409, 'Эта попытка уже использована для другой заявки. Отправьте форму снова.');
      return receipt(getOrder(Number(existing.id))!);
    }
    intakeChecks(body);
    const catalog = publicCatalog(); const settings = catalog.settings;
    const date = text(body.date, 'Дата', 10, 10);
    if (!isWorkingDate(date, settings)) throw new HttpError(400, 'Выберите рабочую дату в пределах доступного периода.');
    const buyerName = text(body.buyerName, 'Ваше имя', 2, 80);
    const comment = text(body.comment ?? '', 'Пожелания', 0, 1000);
    let data: OrderRecord['data']; let total: number | null = null;
    if (kind === 'catalog') {
      if (body.delivery !== 'courier' && body.delivery !== 'pickup') throw new HttpError(400, 'Выберите способ получения.');
      if (body.delivery === 'courier' && !settings.courierEnabled || body.delivery === 'pickup' && !settings.pickupEnabled) throw new HttpError(409, 'Этот способ получения временно недоступен.');
      const timeSlot = text(body.timeSlot, 'Время', 11, 11);
      if (!availableSlots(date, settings).includes(timeSlot)) throw new HttpError(409, 'Этот интервал уже недоступен. Выберите другое время.');
      if (bookingsOn(date) >= settings.dailyCapacity) throw new HttpError(409, 'На эту дату достигнут лимит заказов. Выберите другой день.');
      const buyerPhone = phone(body.buyerPhone, 'Ваш телефон');
      const self = body.selfRecipient === true || body.delivery === 'pickup';
      if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 20) throw new HttpError(400, 'Проверьте состав корзины.');
      const keys = new Set<string>(); let quantity = 0;
      const lines = body.lines.map(candidate => {
        const line = object(candidate); const product = catalog.products.find(p => p.id === line.productId);
        if (!product || !productAvailable(product, date, settings)) throw new HttpError(409, 'Один из букетов недоступен на эту дату. Обновите корзину.');
        if (!['S', 'M', 'L'].includes(String(line.size))) throw new HttpError(400, 'Выберите размер букета.');
        const size = line.size as Size; const count = integer(line.quantity, 'Количество', 1, 12); quantity += count;
        if (!Array.isArray(line.extras) || line.extras.length > 2 || new Set(line.extras).size !== line.extras.length) throw new HttpError(400, 'Проверьте дополнения.');
        const selected = line.extras.map(id => {
          const extra = catalog.extras.find(e => e.id === id);
          if (!extra) throw new HttpError(409, 'Одно из дополнений больше недоступно. Уберите его из корзины.');
          return { id: extra.id, name: extra.name, price: extra.price };
        });
        const lineKey = product.id + ':' + size + ':' + selected.map(e => e.id).sort().join(',');
        if (keys.has(lineKey)) throw new HttpError(400, 'Объедините одинаковые позиции корзины.'); keys.add(lineKey);
        return { productId: product.id, name: product.name, size, quantity: count, bouquetPrice: product.prices[size],
          unitPrice: product.prices[size] + selected.reduce((sum, e) => sum + e.price, 0), extras: selected };
      });
      if (quantity > 24) throw new HttpError(400, 'Для заказа больше 24 букетов свяжитесь с мастерской.');
      const deliveryPrice = body.delivery === 'courier' ? settings.deliveryPrice : 0;
      total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) + deliveryPrice;
      if (integer(body.expectedTotal, 'Сумма', 0, 100000000) !== total) throw new HttpError(409, 'Цена изменилась. Каталог обновится — проверьте новую сумму и отправьте заказ ещё раз.');
      data = { buyerName, buyerPhone, recipientName: self ? buyerName : text(body.recipientName, 'Имя получателя', 2, 80),
        recipientPhone: self ? buyerPhone : phone(body.recipientPhone, 'Телефон получателя'), delivery: body.delivery,
        address: body.delivery === 'courier' ? text(body.address, 'Адрес', 5, 300) : settings.pickupAddress,
        timeSlot, comment, demo: settings.demoMode, deliveryPrice, lines };
    } else {
      if (body.contactMethod !== 'phone' && body.contactMethod !== 'telegram') throw new HttpError(400, 'Выберите способ связи.');
      const contact = body.contactMethod === 'phone' ? phone(body.contact, 'Телефон') : text(body.contact, 'Telegram', 5, 33);
      if (body.contactMethod === 'telegram' && !/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contact)) throw new HttpError(400, 'Укажите имя пользователя Telegram, например @username.');
      data = { buyerName, buyerPhone: body.contactMethod === 'phone' ? contact : '', contactMethod: body.contactMethod, contact,
        budget: integer(body.budget, 'Бюджет', 1500, 2000000), comment, demo: settings.demoMode };
    }
    rateLimit('intake:' + client, 10, 10 * 60000);
    const at = new Date().toISOString();
    const result = db.prepare("INSERT INTO orders(kind,status,date,total,final_total,data,created_at,updated_at,idempotency_key,body_hash) VALUES (?,'new',?,?,NULL,?,?,?,?,?)").run(kind, date, total, JSON.stringify(data), at, at, key, hash);
    const id = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO order_events(order_id,at,status,note) VALUES (?,?,?,?)').run(id, at, 'new', kind === 'catalog' ? 'Заявка с сайта' : 'Индивидуальный букет');
    db.prepare('INSERT INTO notifications(order_id,state,next_at) VALUES (?,?,?)').run(id, 'pending', Date.now());
    return receipt(getOrder(id)!);
  });
}
export function updateOrder(id: number, body: Record<string, unknown>) {
  const version = integer(body.version, 'Версия', 1, 2147483647);
  const note = text(body.note ?? '', 'Комментарий', 0, 1000);
  const db = database();
  return transaction(db, () => {
    const order = getOrder(id); if (!order) throw new HttpError(404, 'Заказ не найден.');
    if (order.version !== version) throw new HttpError(409, 'Заказ уже изменён. Откройте его заново.');
    const status = body.status as OrderStatus;
    if (status !== order.status && !nextStatuses[order.status].includes(status)) throw new HttpError(400, 'Этот переход статуса недоступен.');
    if (order.data.delivery === 'pickup' && status === 'delivery') throw new HttpError(400, 'Для самовывоза выберите «Завершён».');
    const finalTotal = body.finalTotal === null ? null : integer(body.finalTotal, 'Согласованная сумма', 100, 100000000);
    if (['completed', 'cancelled'].includes(order.status)) throw new HttpError(400, 'Завершённый заказ доступен только для просмотра.');
    if (status !== 'new' && status !== 'cancelled' && finalTotal === null) throw new HttpError(400, 'Укажите согласованную с покупателем сумму.');
    if (order.kind === 'custom' && order.status === 'new' && status === 'confirmed' && bookingsOn(order.date) >= shopConfig().settings.dailyCapacity) throw new HttpError(409, 'Лимит заказов на эту дату уже достигнут.');
    if (status === 'cancelled' && !note) throw new HttpError(400, 'Укажите причину отмены.');
    if (finalTotal !== (order.finalTotal ?? order.total) && finalTotal !== null && !note) throw new HttpError(400, 'Опишите согласованное изменение суммы.');
    const at = new Date().toISOString();
    db.prepare('UPDATE orders SET status=?,final_total=?,version=version+1,updated_at=? WHERE id=?').run(status, finalTotal, at, id);
    db.prepare('INSERT INTO order_events(order_id,at,status,note) VALUES (?,?,?,?)').run(id, at, status, note || (status !== order.status ? 'Изменение статуса' : 'Обновлена согласованная сумма'));
    return getOrder(id)!;
  });
}
