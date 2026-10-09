import { allProducts, database, bumpRevision, transaction } from './database.ts';
import { object, text, integer, boolean, phone, HttpError } from './http.ts';
import { validISODate } from '../lib/availability.ts';
import type { Product, ShopSettings, Extra, Size } from '../lib/catalog-types.ts';

export function validateImage(value: unknown) {
  const image = text(value, 'Фотография', 1, 160);
  if (/^\/images\/(pink|cream|lilac|white|mix|red|pastel|spring)\.jpg$/.test(image)) return image;
  const match = /^\/media\/([a-f0-9-]{36}\.webp)$/.exec(image);
  if (match && database().prepare('SELECT filename FROM media WHERE filename=?').get(match[1])) return image;
  throw new HttpError(400, 'Загрузите фотографию через панель управления.');
}
export function validateProduct(body: Record<string, unknown>): Product {
  const id = text(body.id, 'Адрес букета', 2, 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, 'Адрес букета: латинские буквы, цифры и дефисы.');
  if (!['Монобукеты', 'Сборные букеты'].includes(String(body.category)) || !['Светлые', 'Розовые', 'Яркие'].includes(String(body.tone))) throw new HttpError(400, 'Выберите категорию и оттенок.');
  if (!['ready', 'preorder', 'unavailable'].includes(String(body.availability))) throw new HttpError(400, 'Выберите доступность.');
  if (!['S', 'M', 'L'].includes(String(body.photoSize))) throw new HttpError(400, 'Выберите размер на фотографии.');
  const prices = object(body.prices); const descriptions = object(body.sizeDescriptions);
  const position = text(body.imagePosition, 'Положение фотографии', 3, 20);
  if (!/^\d{1,3}% \d{1,3}%$/.test(position) || position.split(' ').some(p => Number(p.replace('%', '')) > 100)) throw new HttpError(400, 'Положение фотографии: два значения от 0% до 100%.');
  if (!Array.isArray(body.images) || body.images.length < 1 || body.images.length > 6) throw new HttpError(400, 'Добавьте от одной до шести фотографий.');
  const images = [...new Set(body.images.map(validateImage))];
  const availability = body.availability as Product['availability'];
  const inputDays = integer(body.preparationDays, 'Подготовка', 0, 30);
  const preparationDays = availability === 'preorder' ? Math.max(1, inputDays) : inputDays;
  return {
    id, name: text(body.name, 'Название', 2, 100), subtitle: text(body.subtitle, 'Короткое описание', 0, 160),
    description: text(body.description, 'Описание', 10, 2000), composition: text(body.composition, 'Состав', 3, 1000),
    category: body.category as Product['category'], tone: body.tone as Product['tone'], label: text(body.label ?? '', 'Метка', 0, 40),
    image: images[0], images, imagePosition: position, photoSize: body.photoSize as Size,
    prices: { S: integer(prices.S, 'Цена S', 100, 2000000), M: integer(prices.M, 'Цена M', 100, 2000000), L: integer(prices.L, 'Цена L', 100, 2000000) },
    sizeDescriptions: { S: text(descriptions.S, 'Описание S', 0, 300), M: text(descriptions.M, 'Описание M', 0, 300), L: text(descriptions.L, 'Описание L', 0, 300) },
    published: boolean(body.published, 'Публикация'), availability, preparationDays,
    readyToday: availability === 'ready' && preparationDays === 0,
    sortOrder: integer(body.sortOrder, 'Порядок', 0, 10000), version: integer(body.version, 'Версия', 0, 2147483647),
  };
}
export function saveProduct(body: Record<string, unknown>) {
  const product = validateProduct(body); const db = database();
  transaction(db, () => {
    const current = db.prepare('SELECT version FROM products WHERE id=?').get(product.id);
    if (current ? Number(current.version) !== product.version : product.version !== 0) throw new HttpError(409, 'Букет уже изменён или этот адрес занят. Обновите список и откройте карточку снова.');
    const nextVersion = product.version + 1;
    db.prepare('INSERT INTO products(id,data,version) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version').run(product.id, JSON.stringify({ ...product, version: nextVersion }), nextVersion);
    bumpRevision();
  });
  return allProducts().find(p => p.id === product.id)!;
}
export function saveSettings(body: Record<string, unknown>) {
  const source = object(body.settings); const db = database();
  if (!Array.isArray(source.workingDays) || !source.workingDays.length || source.workingDays.length > 7) throw new HttpError(400, 'Выберите рабочие дни.');
  const workingDays = [...new Set(source.workingDays.map(d => integer(d, 'Рабочие дни', 1, 7)))];
  if (!Array.isArray(source.closedDates) || source.closedDates.length > 100 || !source.closedDates.every(validISODate)) throw new HttpError(400, 'Закрытые даты: ГГГГ-ММ-ДД, по одной на строку.');
  if (!Array.isArray(source.timeSlots) || !source.timeSlots.length || source.timeSlots.length > 12) throw new HttpError(400, 'Добавьте от одного до двенадцати интервалов.');
  const timeSlots = [...new Set(source.timeSlots.map(slot => {
    const value = text(slot, 'Временной интервал', 11, 11);
    if (!/^([01]\d|2[0-3]):[0-5]\d–([01]\d|2[0-3]):[0-5]\d$/.test(value) || value.slice(0, 5) >= value.slice(6)) throw new HttpError(400, 'Интервалы: 10:00–13:00, по одному на строку.');
    return value;
  }))].sort();
  if (timeSlots.some((slot, i) => i > 0 && slot.slice(0, 5) < timeSlots[i - 1].slice(6))) throw new HttpError(400, 'Временные интервалы не должны пересекаться.');
  const contactPhone = source.contactPhone ? phone(source.contactPhone, 'Телефон мастерской') : '';
  const contactTelegram = text(source.contactTelegram ?? '', 'Telegram', 0, 32).replace(/^@/, '');
  if (contactTelegram && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(contactTelegram)) throw new HttpError(400, 'Telegram: имя пользователя без ссылки.');
  const settings: ShopSettings = {
    timezone: 'Asia/Yekaterinburg', demoMode: boolean(source.demoMode, 'Демо-режим'),
    pickupEnabled: boolean(source.pickupEnabled, 'Самовывоз'), courierEnabled: boolean(source.courierEnabled, 'Доставка'),
    deliveryPrice: integer(source.deliveryPrice, 'Цена доставки', 0, 50000), pickupAddress: text(source.pickupAddress, 'Адрес самовывоза', 0, 300),
    contactPhone, contactTelegram, workingDays, closedDates: [...new Set(source.closedDates)], timeSlots,
    sameDayCutoff: integer(source.sameDayCutoff, 'Заказы на сегодня до', 0, 23),
    sameDayLeadHours: integer(source.sameDayLeadHours, 'Подготовка день в день', 0, 12),
    bookingDays: integer(source.bookingDays, 'Горизонт заказа', 1, 365), dailyCapacity: integer(source.dailyCapacity, 'Лимит заказов в день', 1, 500),
    heroProductId: text(source.heroProductId, 'Букет в hero', 0, 80),
  };
  if (!settings.pickupEnabled && !settings.courierEnabled) throw new HttpError(400, 'Включите доставку или самовывоз.');
  if (!settings.demoMode && (!contactPhone && !contactTelegram || settings.pickupEnabled && settings.pickupAddress.length < 5)) throw new HttpError(400, 'Для рабочего режима укажите контакт мастерской и адрес самовывоза, если он включён.');
  if (settings.heroProductId && !allProducts().some(p => p.id === settings.heroProductId && p.published)) throw new HttpError(400, 'Для hero выберите опубликованный букет.');
  if (!Array.isArray(body.extras) || body.extras.length !== 2) throw new HttpError(400, 'Проверьте дополнения.');
  const ids = ['postcard', 'vase'];
  const extras: Extra[] = body.extras.map((item, i) => {
    const e = object(item); if (e.id !== ids[i]) throw new HttpError(400, 'Некорректное дополнение.');
    return { id: e.id as Extra['id'], name: text(e.name, 'Название дополнения', 2, 60), price: integer(e.price, 'Цена дополнения', 0, 50000), description: text(e.description, 'Описание дополнения', 0, 200), symbol: i ? 'vase' : 'card', enabled: boolean(e.enabled, 'Доступность дополнения') };
  });
  const version = integer(body.version, 'Версия', 1, 2147483647);
  transaction(db, () => {
    const result = db.prepare('UPDATE settings SET data=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify({ settings, extras }), version);
    if (!result.changes) throw new HttpError(409, 'Настройки уже изменены. Обновите страницу перед сохранением.');
    bumpRevision();
  });
  return { settings, extras, version: version + 1 };
}
