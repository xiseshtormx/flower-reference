import { useEffect, useState } from 'react';
import type { CatalogSnapshot } from './catalog-types.ts';

let cached: CatalogSnapshot | null = null;
let pending: Promise<CatalogSnapshot> | null = null;
const listeners = new Set<(catalog: CatalogSnapshot) => void>();
export async function refreshCatalog() {
  if (pending) return pending;
  pending = fetch('/api/catalog', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(async response => {
    if (!response.ok) throw new Error('Не удалось обновить каталог. Попробуйте ещё раз.');
    const catalog = await response.json() as CatalogSnapshot;
    cached = catalog; listeners.forEach(listener => listener(catalog)); return catalog;
  }).finally(() => { pending = null; });
  return pending;
}
export function useCatalog(initial: CatalogSnapshot) {
  const [catalog, setCatalog] = useState(initial);
  useEffect(() => {
    if (cached && cached.revision >= initial.revision) setCatalog(cached);
    listeners.add(setCatalog);
    const refresh = () => { if (document.visibilityState === 'visible') void refreshCatalog().catch(() => {}); };
    refresh(); const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { listeners.delete(setCatalog); clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [initial.revision]);
  return catalog;
}
export async function api<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/' + path, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Сервер не ответил. Проверьте соединение и попробуйте ещё раз.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Не удалось получить ответ сервера. Попробуйте ещё раз.'); }
  if (!response.ok) { const error = new Error(data.error || 'Не удалось выполнить запрос.'); Object.assign(error, { status: response.status }); throw error; }
  return data as T;
}
export interface Receipt { number: string; total: number | null; date: string; demo: boolean; }
