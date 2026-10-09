import type { ExtraId, Size, CatalogSnapshot } from './catalog-types.ts';
import { productAvailable, todayISO, validISODate } from './availability.ts';
export { todayISO } from './availability.ts';

export interface CartLine {
  productId: string;
  size: Size;
  quantity: number;
  extras: ExtraId[];
}
export interface Cart {
  lines: CartLine[];
  date: string;
}
export const EMPTY_CART: Cart = { lines: [], date: '' };
export function lineKey(line: Pick<CartLine, 'productId' | 'size' | 'extras'>) {
  return line.productId + ':' + line.size + ':' + [...line.extras].sort().join(',');
}
export function parseCart(raw: string): Cart {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { ...EMPTY_CART };
    const source = value as { lines?: unknown; date?: unknown };
    const lines: CartLine[] = [];
    if (Array.isArray(source.lines)) {
      for (const candidate of source.lines.slice(0, 100)) {
        if (!candidate || typeof candidate !== 'object') continue;
        const c = candidate as Record<string, unknown>;
        if (typeof c.productId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.productId) || c.productId.length > 80) continue;
        if (!['S', 'M', 'L'].includes(String(c.size))) continue;
        if (typeof c.quantity !== 'number' || !Number.isInteger(c.quantity) || c.quantity < 1) continue;
        const validExtras = Array.isArray(c.extras)
          ? [...new Set(c.extras.filter((id): id is ExtraId => id === 'vase' || id === 'postcard'))]
          : [];
        const line: CartLine = { productId: c.productId, size: c.size as Size, quantity: Math.min(c.quantity, 12), extras: validExtras };
        const existing = lines.find((item) => lineKey(item) === lineKey(line));
        if (existing) existing.quantity = Math.min(12, existing.quantity + line.quantity);
        else lines.push(line);
      }
    }
    const date = validISODate(source.date) ? source.date : '';
    return { lines, date };
  } catch { return { lines: [], date: '' }; }
}
export function unitPrice(line: CartLine, catalog: CatalogSnapshot) {
  const product = catalog.products.find(p => p.id === line.productId);
  if (!product) return 0;
  return product.prices[line.size] + catalog.extras.filter((extra) => line.extras.includes(extra.id)).reduce((sum, extra) => sum + extra.price, 0);
}
export const cartSubtotal = (cart: Cart, catalog: CatalogSnapshot) => cart.lines.reduce((sum, line) => sum + unitPrice(line, catalog) * line.quantity, 0);
export const cartCount = (cart: Cart) => cart.lines.reduce((sum, line) => sum + line.quantity, 0);
export function addLine(cart: Cart, line: Omit<CartLine, 'quantity'>): Cart {
  const next = { ...cart, lines: cart.lines.map((item) => ({ ...item, extras: [...item.extras] })) };
  const existing = next.lines.find((item) => lineKey(item) === lineKey(line));
  if (existing) existing.quantity = Math.min(12, existing.quantity + 1);
  else next.lines.push({ ...line, extras: [...line.extras], quantity: 1 });
  return next;
}
export function changeQuantity(cart: Cart, key: string, delta: number): Cart {
  return {
    ...cart,
    lines: cart.lines.map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(12, line.quantity + delta) } : line)
      .filter((line) => line.quantity > 0),
  };
}
export function dateLabel(date: string) {
  if (!date) return 'Выбрать дату';
  if (date === todayISO()) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Yekaterinburg' }).format(new Date(date + 'T12:00:00+05:00'));
}
export function availableOn(productId: string, date: string, catalog: CatalogSnapshot) {
  return productAvailable(catalog.products.find(p => p.id === productId), date, catalog.settings);
}
