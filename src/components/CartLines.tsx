import { sitePath } from '../lib/site-path';
import { formatPrice } from '../data/products.ts';
import { type Cart, lineKey, unitPrice, changeQuantity, availableOn } from '../lib/cart-model.ts';
import { getCart, setCart } from '../lib/store.ts';
import Icon from './Icon';
import type { CatalogSnapshot } from '../lib/catalog-types';

export default function CartLines({ cart, catalog }: { cart: Cart; catalog: CatalogSnapshot }) {
  return <div className="cart-lines">{cart.lines.map((line) => {
    const product = catalog.products.find(p => p.id === line.productId);
    const extras = catalog.extras;
    const key = lineKey(line);
    if (!product) return <article className="cart-line cart-line-missing" key={key}><div><strong>Букет больше не продаётся</strong><p className="muted">{line.productId} · размер {line.size} · {line.quantity} шт.</p><button className="text-button" type="button" onClick={() => setCart({ ...getCart(), lines: getCart().lines.filter(item => lineKey(item) !== key) })}>Удалить из корзины</button></div></article>;
    const missingExtras = line.extras.filter(id => !extras.some(e => e.id === id));
    return <article className="cart-line" key={key}>
      <a href={sitePath('/bouquet/' + product.id + '/')} tabIndex={-1} aria-hidden="true">
        <img src={sitePath(product.image)} alt="" width="90" height="110" style={{ objectPosition: product.imagePosition }} />
      </a>
      <div className="cart-line-body">
        <a className="cart-line-title" href={sitePath('/bouquet/' + product.id + '/')}>{product.name}</a>
        <p className="muted">Размер {line.size}{line.extras.length > 0 ? ' · ' + extras.filter((extra) => line.extras.includes(extra.id)).map((extra) => extra.name).join(', ') : ''}</p>
        {!availableOn(product.id, cart.date, catalog) && <p className="field-error">Этот букет недоступен на выбранную дату. Выберите другую дату.</p>}
        {missingExtras.length > 0 && <p className="field-error">Дополнение недоступно. <button type="button" className="text-button" onClick={() => setCart({ ...getCart(), lines: getCart().lines.map(item => lineKey(item) === key ? { ...item, extras: item.extras.filter(id => !missingExtras.includes(id)) } : item) })}>Убрать дополнение</button></p>}
        <div className="cart-line-bottom">
          <div className="quantity">
            <button type="button" aria-label={'Уменьшить количество: ' + product.name} onClick={() => setCart(changeQuantity(getCart(), key, -1))}><Icon name="minus" size={14} /></button>
            <span aria-label="Количество">{line.quantity}</span>
            <button type="button" disabled={line.quantity >= 12} aria-label={'Увеличить количество: ' + product.name} onClick={() => setCart(changeQuantity(getCart(), key, 1))}><Icon name="plus" size={14} /></button>
          </div>
          <strong>{formatPrice(unitPrice(line, catalog) * line.quantity)}</strong>
        </div>
      </div>
      <button type="button" className="remove-line" aria-label={'Удалить: ' + product.name} onClick={() => setCart({ ...getCart(), lines: getCart().lines.filter((item) => lineKey(item) !== key) })}><Icon name="close" size={16} /></button>
    </article>;
  })}</div>;
}
