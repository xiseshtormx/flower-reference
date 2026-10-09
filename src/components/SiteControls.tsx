import { sitePath } from '../lib/site-path';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import CartLines from './CartLines';
import { useCart, getCart, setCart } from '../lib/store.ts';
import { cartCount, cartSubtotal, dateLabel, todayISO } from '../lib/cart-model.ts';
import { formatPrice } from '../data/products.ts';
import { useCatalog } from '../lib/catalog-client';
import type { CatalogSnapshot } from '../lib/catalog-types';
import { shiftDate, isWorkingDate, availableSlots } from '../lib/availability';

export default function SiteControls({ initialCatalog }: { initialCatalog: CatalogSnapshot }) {
  const catalog = useCatalog(initialCatalog);
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<'cart' | 'date' | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setMounted(true);
    const open = () => setKind('cart');
    window.addEventListener('flower:open-cart', open);
    return () => window.removeEventListener('flower:open-cart', open);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (kind && mounted && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [kind, mounted]);
  const count = cartCount(cart);
  return <>
    <div className="site-controls">
      <button className="date-control" type="button" onClick={() => {
        setDraftDate(cart.date >= todayISO() ? cart.date : todayISO());
        setKind('date');
      }} aria-haspopup="dialog">
        <Icon name="calendar" size={18} /><span>{dateLabel(cart.date)}</span>
      </button>
      <a className="icon-button favorite-link" href={sitePath('/?favorites=1#catalog')} aria-label="Избранные букеты"><Icon name="heart" /></a>
      <button className="basket-control" type="button" aria-label={'Открыть корзину, товаров: ' + count} aria-haspopup="dialog" onClick={() => setKind('cart')}>
        <Icon name="bag" /><span className="cart-count" aria-live="polite">{count}</span>
      </button>
    </div>
    {mounted && kind && createPortal(
      <dialog ref={dialogRef} className={kind === 'cart' ? 'cart-dialog' : 'date-dialog'} aria-labelledby={kind === 'cart' ? 'drawer-title' : 'date-dialog-title'} onCancel={() => setKind(null)} onClick={(event) => { if (event.target === event.currentTarget) setKind(null); }}>
        <div className="dialog-content">
          <div className="dialog-heading">
            <div><span className="eyebrow">{kind === 'cart' ? 'ВАШ ВЫБОР' : 'УДОБНЫЙ ДЕНЬ'}</span><h2 id={kind === 'cart' ? 'drawer-title' : 'date-dialog-title'}>{kind === 'cart' ? 'Корзина' : 'Когда доставить?'}</h2></div>
            <button className="icon-button" type="button" aria-label="Закрыть окно" onClick={() => setKind(null)}><Icon name="close" /></button>
          </div>
          {kind === 'date' ? <form onSubmit={(event) => {
            event.preventDefault();
            setCart({ ...getCart(), date: draftDate });
            setKind(null);
          }}>
            <p className="muted">Дата поможет показать подходящие букеты. Время и адрес выберете при оформлении.</p>
            <label className="field-label" htmlFor="delivery-date-picker">Дата доставки</label>
            <input id="delivery-date-picker" className="form-input" type="date" min={todayISO()} max={shiftDate(todayISO(), catalog.settings.bookingDays)} value={draftDate} onChange={(event) => setDraftDate(event.target.value)} required />
            <p className="muted">Время указано по Перми. Доступность заказа проверим при оформлении.</p>{draftDate && (!isWorkingDate(draftDate, catalog.settings) || !availableSlots(draftDate, catalog.settings).length) && <p className="field-error">На этот день приём заказов закрыт. Выберите другую дату.</p>}<button className="button button-primary full-width" type="submit" disabled={!isWorkingDate(draftDate, catalog.settings) || !availableSlots(draftDate, catalog.settings).length}>Выбрать дату</button>
          </form> : cart.lines.length ? <>
            <p className="drawer-date">Доставка: {cart.date ? dateLabel(cart.date) : 'дату выберете при оформлении'}</p>
            <CartLines cart={cart} catalog={catalog} />
            <div className="drawer-summary">
              <div className="summary-row"><span>Товары</span><strong>{formatPrice(cartSubtotal(cart, catalog))}</strong></div>
              <p className="muted">Доставка рассчитывается при оформлении.</p>
              <a href={sitePath('/cart/')} className="button button-primary full-width">Перейти к оформлению</a>
              <button type="button" className="text-button" onClick={() => setKind(null)}>Продолжить выбирать</button>
            </div>
          </> : <div className="empty-cart">
            <Icon name="flower" size={48} />
            <h3>Здесь будет ваш букет</h3>
            <p>Выберите цветы в каталоге. Мы сохраним ваш выбор в этом браузере.</p>
            <a href={sitePath('/#catalog')} className="button button-primary" onClick={() => setKind(null)}>Выбрать букет</a>
          </div>}
        </div>
      </dialog>, document.body,
    )}
  </>;
}
