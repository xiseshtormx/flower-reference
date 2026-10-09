import { useEffect, useState } from 'react';
import { api } from '../../lib/catalog-client';
import { statusLabels, orderStatuses, nextStatuses, type OrderRecord, type OrderStatus } from '../../lib/catalog-types';
import { formatPrice } from '../../data/products';
import { errorMessage } from './AdminApp';

interface OrderList { orders: OrderRecord[]; count: number; page: number; pages: number; counts: { status: OrderStatus; count: number }[]; }
const timestamp = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Yekaterinburg', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export default function AdminOrders({ telegramConfigured, onSessionExpired }: { telegramConfigured: boolean; onSessionExpired: () => void }) {
  const [list, setList] = useState<OrderList | null>(null);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setList(await api<OrderList>('admin/orders?' + new URLSearchParams({ status, kind, page: String(page) }))); setError(''); }
    catch (failure) { if ((failure as { status?: number }).status === 401) onSessionExpired(); else setError(errorMessage(failure)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000); return () => clearInterval(timer); }, [status, kind, page]);
  return <>
    <div className="admin-section-heading"><div><p className="admin-kicker">РАБОТА С ПОКУПАТЕЛЯМИ</p><h1>Заявки</h1><p>Наличие, состав и стоимость согласуйте перед подтверждением.</p></div><button className="admin-button admin-button-secondary" disabled={loading} onClick={load}>{loading ? 'Обновляем…' : 'Обновить'}</button></div>
    <div className="admin-order-counts">{(['new', 'confirmed', 'preparing', 'delivery'] as OrderStatus[]).map(value => <button key={value} onClick={() => { setStatus(value); setPage(1); }}><span>{statusLabels[value]}</span><strong>{list?.counts.find(row => row.status === value)?.count ?? 0}</strong></button>)}</div>
    <div className="admin-filters"><label>Статус<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Все статусы</option>{orderStatuses.map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label><label>Тип заявки<select value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}><option value="">Все заявки</option><option value="catalog">Из каталога</option><option value="custom">Индивидуальный букет</option></select></label><span>{list?.count ?? 0} заявок · время по Перми</span></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className={'admin-orders-layout' + (selected ? ' has-selection' : '')}>
      <div><div className="admin-order-list">{list?.orders.map(order => <button key={order.id} className={'admin-order-row' + (selected?.id === order.id ? ' is-selected' : '')} onClick={async () => { try { const result = await api<{ order: OrderRecord }>('admin/orders/' + order.id); setSelected(result.order); setError(''); } catch (failure) { setError(errorMessage(failure)); } }}><div><strong>{order.number}</strong><span>{order.data.demo ? 'Тест · ' : ''}{order.kind === 'custom' ? 'Индивидуальный' : 'Из каталога'}</span></div><div><strong>{order.data.buyerName}</strong><span>{order.date} {order.data.timeSlot || ''}</span></div><div><strong>{order.finalTotal !== null || order.total !== null ? formatPrice(order.finalTotal ?? order.total!) : 'Бюджет ' + formatPrice(order.data.budget!)}</strong><span className={'admin-status status-' + order.status}>{statusLabels[order.status]}</span></div></button>)}</div>
        {list && !list.orders.length && <div className="admin-empty"><h2>Заявок пока нет</h2><p>Отправьте тестовый заказ с сайта или измените фильтры.</p><a href="/" target="_blank" rel="noopener">Открыть сайт</a></div>}
        {list && list.pages > 1 && <div className="admin-pagination"><button className="admin-button admin-button-secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Предыдущие</button><span>{page} / {list.pages}</span><button className="admin-button admin-button-secondary" disabled={page >= list.pages || loading} onClick={() => setPage(page + 1)}>Следующие</button></div>}
      </div>
      {selected && <OrderDetails key={selected.id + ':' + selected.version} order={selected} telegramConfigured={telegramConfigured} onClose={() => setSelected(null)} onSaved={async order => { setSelected(order); await load(); }} />}
    </div>
  </>;
}
function OrderDetails({ order, telegramConfigured, onClose, onSaved }: { order: OrderRecord; telegramConfigured: boolean; onClose: () => void; onSaved: (order: OrderRecord) => Promise<void> }) {
  const [status, setStatus] = useState(order.status);
  const [amount, setAmount] = useState(String(order.finalTotal ?? order.total ?? ''));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const terminal = ['completed', 'cancelled'].includes(order.status);
  const contact = order.data.contactMethod === 'telegram' ? order.data.contact : order.data.buyerPhone;
  return <aside className="admin-order-detail">
    <div className="admin-dialog-heading"><div><p className="admin-kicker">{order.data.demo ? 'ТЕСТОВАЯ ЗАЯВКА' : 'ЗАЯВКА'}</p><h2>{order.number}</h2></div><button className="admin-link" onClick={onClose}>Закрыть</button></div>
    <span className={'admin-status status-' + order.status}>{statusLabels[order.status]}</span>
    <dl className="admin-order-info"><dt>Покупатель</dt><dd>{order.data.buyerName}</dd><dt>Связь</dt><dd>{contact}</dd><dt>Дата</dt><dd>{order.date} {order.data.timeSlot || ''}</dd>{order.data.delivery && <><dt>Получение</dt><dd>{order.data.delivery === 'courier' ? 'Курьером' : 'Самовывоз'}</dd><dt>Адрес</dt><dd>{order.data.address || 'Не указан в демо'}</dd><dt>Получатель</dt><dd>{order.data.recipientName} · {order.data.recipientPhone}</dd></>}<dt>Пожелания</dt><dd className="admin-prewrap">{order.data.comment || 'Не указаны'}</dd>{order.kind === 'custom' && <><dt>Бюджет</dt><dd>{formatPrice(order.data.budget!)}</dd></>}</dl>
    {order.data.lines?.map((line, index) => <div className="admin-order-line" key={index}><strong>{line.name} · {line.size} · {line.quantity} шт.</strong><span>{line.extras.map(extra => extra.name + ' ' + formatPrice(extra.price)).join(', ') || 'Без дополнений'}</span><span>{formatPrice(line.unitPrice)} × {line.quantity} = {formatPrice(line.unitPrice * line.quantity)}</span></div>)}
    {order.total !== null && <p className="admin-order-total">Сумма при отправке <strong>{formatPrice(order.total)}</strong><small>Получение: {formatPrice(order.data.deliveryPrice ?? 0)}</small></p>}
    {!terminal && <form className="admin-order-edit" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { const result = await api<{ order: OrderRecord }>('admin/orders/' + order.id, 'PATCH', { version: order.version, status, finalTotal: amount ? Number(amount) : null, note }); await onSaved(result.order); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}><fieldset className="admin-fieldset" disabled={busy}><label>Статус<select value={status} onChange={event => setStatus(event.target.value as OrderStatus)}>{[order.status, ...nextStatuses[order.status]].filter(value => !(order.data.delivery === 'pickup' && value === 'delivery')).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label>Согласованная сумма, ₽<input type="number" min={100} max={100000000} value={amount} onChange={event => setAmount(event.target.value)} /><small>Для индивидуального букета укажите сумму после согласования.</small></label><label>Комментарий к изменению<textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Согласованный состав, изменение суммы или причина отмены" /></label><button className="admin-button">{busy ? 'Сохраняем…' : 'Сохранить изменения'}</button></fieldset></form>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-notification"><strong>Telegram</strong><p>{!telegramConfigured ? 'Не подключён. Все заявки доступны в панели.' : order.notification?.state === 'sent' ? 'Уведомление отправлено.' : order.notification?.state === 'failed' ? 'Не удалось доставить уведомление. Заявка сохранена.' : 'Уведомление ожидает отправки.'}</p>{telegramConfigured && <button className="admin-link" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('admin/orders/' + order.id + '/notification', 'POST', {}); setNotice('Уведомление поставлено в очередь.'); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}>Отправить уведомление ещё раз</button>}{notice && <p role="status">{notice}</p>}</div>
    <h3>История заявки</h3><ol className="admin-history">{order.events.map((event, index) => <li key={index}><small>{timestamp(event.at)} · {statusLabels[event.status]}</small><p>{event.note}</p></li>)}</ol>
  </aside>;
}
