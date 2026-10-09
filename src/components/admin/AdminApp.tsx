import { useEffect, useState } from 'react';
import { api } from '../../lib/catalog-client';
import type { Product, ShopSettings, Extra } from '../../lib/catalog-types';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import AdminSettings from './AdminSettings';

export interface AdminData { products: Product[]; settings: ShopSettings; extras: Extra[]; version: number; telegramConfigured: boolean; }
export const errorMessage = (error: unknown) => error instanceof Error ? ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name) ? 'Проверьте соединение с сервером и попробуйте ещё раз.' : error.message : 'Не удалось выполнить запрос.';
export default function AdminApp({ authenticated }: { authenticated: boolean }) {
  const [signedIn, setSignedIn] = useState(authenticated);
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<'orders' | 'products' | 'settings'>('orders');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { const next = await api<AdminData>('admin/bootstrap'); setData(next); setError(''); }
    catch (failure) { if ((failure as { status?: number }).status === 401) { setSignedIn(false); setData(null); } setError(errorMessage(failure)); }
  };
  useEffect(() => { if (signedIn) void load(); }, [signedIn]);
  useEffect(() => { const value = location.hash.slice(1); if (['orders', 'products', 'settings'].includes(value)) setTab(value as typeof tab); }, []);
  if (!signedIn) return <main className="admin-login"><a href="/" className="admin-back">Открыть сайт</a><p className="admin-kicker">ЦВЕТОЧНАЯ МАСТЕРСКАЯ</p><h1>Панель управления</h1><p>Ассортимент, заявки и расписание — в одном месте.</p><form onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await api('admin/login', 'POST', { login: fields.get('login'), password: fields.get('password') }); setSignedIn(true); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }}><label>Логин<input name="login" autoComplete="username" required maxLength={80} autoFocus /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" required maxLength={200} /></label><button className="admin-button" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>{error && <p className="admin-error" role="alert">{error}</p>}</form></main>;
  return <div className="admin-shell">
    <header className="admin-header"><div><a href="/" className="admin-wordmark">Цветочная мастерская</a><span>Панель управления</span></div><div className="admin-header-actions">{data?.settings.demoMode && <span className="admin-badge">Тестовый режим</span>}<a href="/" target="_blank" rel="noopener">Посмотреть сайт</a><button className="admin-link" onClick={async () => { try { await api('admin/logout', 'POST', {}); setSignedIn(false); setData(null); } catch (failure) { setError(errorMessage(failure)); } }}>Выйти</button></div></header>
    <nav className="admin-nav" aria-label="Разделы панели">{([['orders', 'Заявки'], ['products', 'Букеты'], ['settings', 'Настройки']] as const).map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); history.replaceState(null, '', '#' + id); }}>{label}</button>)}</nav>
    <main className="admin-main">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!data ? <div className="admin-empty"><p>Загружаем панель…</p><button className="admin-button admin-button-secondary" onClick={load}>Повторить загрузку</button></div> : <>
        {tab === 'orders' && <AdminOrders telegramConfigured={data.telegramConfigured} onSessionExpired={() => { setSignedIn(false); setData(null); }} />}
        {tab === 'products' && <AdminProducts products={data.products} onSaved={load} />}
        {tab === 'settings' && <AdminSettings data={data} onSaved={load} />}
      </>}
    </main>
  </div>;
}
