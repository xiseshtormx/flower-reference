import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../data/products.ts';
import type { CatalogSnapshot } from '../lib/catalog-types.ts';
import { useCatalog, refreshCatalog, api, type Receipt } from '../lib/catalog-client.ts';
import { useCart, setCart, getCart } from '../lib/store.ts';
import { cartSubtotal, todayISO, availableOn, dateLabel, lineKey } from '../lib/cart-model.ts';
import { availableSlots, shiftDate, isWorkingDate } from '../lib/availability.ts';
import CartLines from './CartLines';
import Icon from './Icon';

export default function CartPage({ initialCatalog }: { initialCatalog: CatalogSnapshot }) {
  const catalog = useCatalog(initialCatalog);
  const { settings, extras } = catalog;
  const cart = useCart();
  const [delivery, setDelivery] = useState<'courier' | 'pickup'>(settings.courierEnabled ? 'courier' : 'pickup');
  const [selfRecipient, setSelfRecipient] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const attempt = useRef({ signature: '', key: '' });
  const deliveryCost = delivery === 'courier' ? settings.deliveryPrice : 0;
  const subtotal = cartSubtotal(cart, catalog);
  const slots = availableSlots(cart.date, settings);
  const validDate = isWorkingDate(cart.date, settings) && slots.length > 0;
  const unavailable = cart.lines.some(line => !availableOn(line.productId, cart.date, catalog) || line.extras.some(id => !extras.some(e => e.id === id)));
  useEffect(() => { if (!slots.includes(timeSlot)) setTimeSlot(''); }, [cart.date, slots.join(',')]);
  useEffect(() => { if (delivery === 'courier' && !settings.courierEnabled) setDelivery('pickup'); else if (delivery === 'pickup' && !settings.pickupEnabled) setDelivery('courier'); }, [settings.courierEnabled, settings.pickupEnabled]);
  if (receipt) return <div className="confirmation-panel" role="status"><span className="confirmation-icon"><Icon name="check" size={38} /></span><span className="eyebrow">{receipt.demo ? 'ТЕСТОВАЯ ЗАЯВКА' : 'ЗАЯВКА ПОЛУЧЕНА'}</span><h2>{receipt.number}</h2><p>Дата: {dateLabel(receipt.date)}.<br />Сумма по каталогу — {formatPrice(receipt.total!)}.</p><p className="muted">{receipt.demo ? 'Заявка сохранена в панели управления для проверки. Цветы не доставляются, деньги не списываются.' : 'Флорист свяжется с вами и подтвердит состав, время и сумму. Оплата — по согласованию с мастерской.'}</p><a className="button button-primary" href="/#catalog">Вернуться к букетам</a></div>;
  if (!cart.lines.length) return <div className="empty-cart cart-page-empty"><Icon name="flower" size={58} /><h2>Выберите ваш первый букет</h2><p>После добавления здесь появятся товары, дополнения и оформление доставки.</p><a className="button button-primary" href="/#catalog">Открыть каталог</a></div>;
  return <div className="checkout-grid">
    <div>
      <div className="checkout-section-heading"><h2>Ваши букеты</h2><a href="/#catalog" className="text-link">Добавить ещё <Icon name="plus" size={16} /></a></div>
      <CartLines cart={cart} catalog={catalog} />
      <p className="cart-extras-note"><Icon name="card" size={20} />Открытку и вазу можно добавить на странице выбранного букета.</p>
      <form id="checkout-form" className="checkout-form" onSubmit={async event => {
        event.preventDefault();
        if (sending || !validDate || unavailable || !cart.lines.length) return;
        const fields = new FormData(event.currentTarget);
        const value = (key: string) => String(fields.get(key) ?? '');
        const body = { lines: cart.lines, date: cart.date, delivery, timeSlot,
          address: value('address'), buyerName: value('buyer-name'), buyerPhone: value('buyer-phone'),
          selfRecipient: selfRecipient || delivery === 'pickup', recipientName: value('recipient-name'), recipientPhone: value('recipient-phone'),
          comment: value('comment'), expectedTotal: subtotal + deliveryCost, consent: fields.get('consent') === 'on',
          demoAcknowledged: fields.get('demoAcknowledged') === 'on', website: value('website') };
        const signature = JSON.stringify(body);
        if (attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
        setSending(true); setError('');
        try {
          const result = await api<Receipt>('orders', 'POST', body, attempt.current.key);
          // Remove only submitted quantities; preserve any flowers added while the request was in flight.
          const current = getCart();
          setCart({ ...current, lines: current.lines.map(line => ({ ...line, quantity: line.quantity - (body.lines.find(item => lineKey(item) === lineKey(line))?.quantity ?? 0) })).filter(line => line.quantity > 0) });
          setReceipt(result);
          requestAnimationFrame(() => document.querySelector('.confirmation-panel')?.scrollIntoView({ block: 'start' }));
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'Не удалось отправить заявку. Попробуйте ещё раз.');
          try { await refreshCatalog(); } catch {}
        } finally { setSending(false); }
      }}>
        <fieldset className="form-fields-reset" disabled={sending}>
          <div className="checkout-section-heading"><h2>Получение букета</h2></div>
          <div className="delivery-options">
            {settings.courierEnabled && <label className={delivery === 'courier' ? 'selected' : ''}><input type="radio" name="delivery-method" checked={delivery === 'courier'} onChange={() => setDelivery('courier')} /><span><strong>Курьером по Перми</strong><small>{formatPrice(settings.deliveryPrice)}</small></span></label>}
            {settings.pickupEnabled && <label className={delivery === 'pickup' ? 'selected' : ''}><input type="radio" name="delivery-method" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} /><span><strong>Самовывоз</strong><small>Бесплатно</small></span></label>}
          </div>
          <div className="form-grid">
            <label className="form-field"><span>Дата {delivery === 'courier' ? 'доставки' : 'самовывоза'}</span><input type="date" min={todayISO()} max={shiftDate(todayISO(), settings.bookingDays)} required value={cart.date} onChange={event => setCart({ ...getCart(), date: event.target.value })} /></label>
            <label className="form-field"><span>Время по Перми</span><select name="time-slot" required value={timeSlot} onChange={event => setTimeSlot(event.target.value)}><option value="" disabled>Выберите время</option>{slots.map(slot => <option key={slot}>{slot}</option>)}</select></label>
          </div>
          {!validDate && <p className="field-error">Выберите доступный день. Приём на сегодня зависит от времени и расписания мастерской.</p>}
          {unavailable && <p className="field-error">Некоторые букеты или дополнения недоступны. Измените дату или состав заказа.</p>}
          {delivery === 'courier' ? <label className="form-field"><span>Адрес доставки в Перми</span><input name="address" autoComplete="street-address" placeholder="Улица, дом, квартира или офис" required minLength={5} maxLength={300} /></label> : <p className="pickup-note">{settings.pickupAddress || 'В демо-режиме адрес мастерской не задан.'}</p>}
          <div className="checkout-section-heading"><h2>Контакты</h2></div>
          <div className="form-grid">
            <label className="form-field"><span>Ваше имя</span><input name="buyer-name" autoComplete="given-name" placeholder="Как к вам обращаться" required minLength={2} maxLength={80} /></label>
            <label className="form-field"><span>Ваш телефон</span><input name="buyer-phone" type="tel" autoComplete="tel" placeholder="+7 999 123-45-67" required minLength={10} maxLength={24} /></label>
          </div>
          {delivery === 'courier' && <label className="check-field"><input type="checkbox" checked={selfRecipient} onChange={event => setSelfRecipient(event.target.checked)} /><span>Я получатель букета</span></label>}
          {!selfRecipient && delivery === 'courier' && <div className="form-grid recipient-fields"><label className="form-field"><span>Имя получателя</span><input name="recipient-name" placeholder="Кому доставить цветы" required minLength={2} maxLength={80} /></label><label className="form-field"><span>Телефон получателя</span><input name="recipient-phone" type="tel" placeholder="+7 999 123-45-67" required minLength={10} maxLength={24} /></label></div>}
          <label className="form-field"><span>{cart.lines.some(line => line.extras.includes('postcard')) ? 'Текст открытки и пожелания' : 'Пожелания к заказу'}</span><textarea name="comment" rows={3} maxLength={1000} placeholder="Что важно учесть при сборке и доставке" /></label>
          <label className="check-field consent-field"><input type="checkbox" name="consent" required /><span>Можно связаться со мной по заявке. <a href="/privacy/" target="_blank" rel="noopener">Как используются данные</a></span></label>
          {settings.demoMode && <label className="check-field consent-field"><input type="checkbox" name="demoAcknowledged" required /><span>Это тестовая заявка. Использую тестовые контакты.</span></label>}
          <label className="form-trap" aria-hidden="true">Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </fieldset>
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
      </form>
    </div>
    <aside className="checkout-summary"><span className="eyebrow">ВАША ЗАЯВКА</span><h2>Итого</h2><div className="summary-row"><span>Букеты и дополнения</span><span>{formatPrice(subtotal)}</span></div><div className="summary-row"><span>{delivery === 'courier' ? 'Доставка' : 'Самовывоз'}</span><span>{deliveryCost ? formatPrice(deliveryCost) : 'Бесплатно'}</span></div><div className="summary-total"><span>Сумма</span><strong aria-live="polite">{formatPrice(subtotal + deliveryCost)}</strong></div><button className="button button-primary full-width" type="submit" form="checkout-form" disabled={sending || !validDate || unavailable}>{sending ? 'Отправляем…' : 'Отправить заявку'}</button><p className="checkout-demo-note">{settings.demoMode ? 'Тестовая заявка сохранится в панели. Доставка и оплата не выполняются.' : 'Наличие, состав и время подтвердит флорист. Онлайн-оплата не подключена.'}</p></aside>
  </div>;
}
