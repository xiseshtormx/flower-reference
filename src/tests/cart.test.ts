import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCart, addLine, changeQuantity, cartSubtotal, cartCount, lineKey, unitPrice, availableOn, todayISO } from '../src/lib/cart-model.ts';
import { products } from '../src/data/products.ts';

const empty = () => ({ lines: [], date: '' });
test('Повреждённое хранилище не ломает корзину', () => {
  for (const raw of ['broken JSON', 'null', '[]', '42']) assert.deepEqual(parseCart(raw).lines, []);
});
test('Неизвестные товары и неверные размеры отбрасываются', () => {
  const cart = parseCart(JSON.stringify({ lines: [
    { productId: 'unknown', size: 'M', quantity: 1, extras: [] },
    { productId: products[0].id, size: 'XL', quantity: 1, extras: [] },
    { productId: products[0].id, size: 'M', quantity: -3, extras: [] },
    { productId: products[0].id, size: 'M', quantity: 2.5, extras: [] },
  ] }));
  assert.equal(cart.lines.length, 0);
});
test('Совпадающие букеты объединяются, размер и дополнения разделяют позиции', () => {
  const item = { productId: products[0].id, size: 'M' as const, extras: [] };
  let cart = addLine(empty(), item);
  cart = addLine(cart, item);
  cart = addLine(cart, { ...item, size: 'L' });
  cart = addLine(cart, { ...item, extras: ['vase'] });
  assert.equal(cart.lines.length, 3);
  assert.equal(cartCount(cart), 4);
  assert.equal(cart.lines[0].quantity, 2);
});
test('Цена учитывает размер, дополнения и количество', () => {
  const cart = addLine(empty(), { productId: products[0].id, size: 'L', extras: ['vase', 'postcard'] });
  assert.equal(unitPrice(cart.lines[0]), products[0].prices.L + 790 + 150);
  const next = changeQuantity(cart, lineKey(cart.lines[0]), 1);
  assert.equal(cartSubtotal(next), (products[0].prices.L + 790 + 150) * 2);
});
test('Порядок дополнений не создаёт дубли', () => {
  const a = { productId: products[0].id, size: 'M' as const, extras: ['vase', 'postcard'] as const };
  let cart = addLine(empty(), { ...a, extras: [...a.extras] });
  cart = addLine(cart, { ...a, extras: ['postcard', 'vase'] });
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0].quantity, 2);
});
test('Последнее уменьшение удаляет позицию, увеличение ограничено 12', () => {
  let cart = addLine(empty(), { productId: products[0].id, size: 'M', extras: [] });
  const key = lineKey(cart.lines[0]);
  assert.equal(changeQuantity(cart, key, -1).lines.length, 0);
  for (let i = 0; i < 30; i++) cart = changeQuantity(cart, key, 1);
  assert.equal(cart.lines[0].quantity, 12);
});
test('Неизвестные и повторяющиеся дополнения не меняют стоимость', () => {
  const cart = parseCart(JSON.stringify({ lines: [{ productId: products[0].id, size: 'M', quantity: 1, extras: ['vase', 'vase', 'unknown'] }] }));
  assert.deepEqual(cart.lines[0].extras, ['vase']);
  assert.equal(cartSubtotal(cart), products[0].prices.M + 790);
});
test('Невозможная дата отбрасывается; доступность зависит от дня', () => {
  assert.equal(parseCart('{"date":"2026-02-31"}').date, '');
  const product = products.find((item) => !item.readyToday)!;
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
  assert.equal(availableOn(product.id, todayISO()), false);
  assert.equal(availableOn(product.id, tomorrow), true);
  assert.equal(availableOn(product.id, '2020-01-01'), false);
});
