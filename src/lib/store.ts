import { useSyncExternalStore } from 'react';
import { parseCart, addLine, type Cart, type CartLine } from './cart-model.ts';

const CART_KEY = 'flower-reference-cart-v1';
const FAVORITES_KEY = 'flower-reference-favorites-v1';
const memory: Record<string, string> = {};
function read(key: string) {
  if (typeof window === 'undefined') return '';
  if (memory[key] !== undefined) return memory[key];
  try { return window.localStorage.getItem(key) ?? ''; }
  catch { return memory[key] ?? ''; }
}
function write(key: string, value: string) {
  memory[key] = value;
  try { window.localStorage.setItem(key, value); } catch { /* Memory fallback. */ }
  window.dispatchEvent(new Event('flower:change'));
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) {
      delete memory[CART_KEY];
      delete memory[FAVORITES_KEY];
    } else if (event.key === CART_KEY || event.key === FAVORITES_KEY) {
      memory[event.key] = event.newValue ?? '';
    }
    callback();
  };
  window.addEventListener('flower:change', callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('flower:change', callback);
    window.removeEventListener('storage', onStorage);
  };
}
const serverSnapshot = () => '';
const cartSnapshot = () => read(CART_KEY);
const favoritesSnapshot = () => read(FAVORITES_KEY);
export const getCart = () => parseCart(read(CART_KEY));
export function useCart() {
  return parseCart(useSyncExternalStore(subscribe, cartSnapshot, serverSnapshot));
}
export function setCart(cart: Cart) {
  write(CART_KEY, JSON.stringify(cart));
}
export function addToCart(line: Omit<CartLine, 'quantity'>) {
  setCart(addLine(getCart(), line));
  window.dispatchEvent(new Event('flower:open-cart'));
}
function parseFavorites(raw: string): string[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data)
      ? [...new Set(data.filter((id): id is string => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 80))].slice(0, 200)
      : [];
  } catch { return []; }
}
export function useFavorites() {
  return parseFavorites(useSyncExternalStore(subscribe, favoritesSnapshot, serverSnapshot));
}
export function toggleFavorite(id: string) {
  const list = parseFavorites(read(FAVORITES_KEY));
  write(FAVORITES_KEY, JSON.stringify(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]));
}
