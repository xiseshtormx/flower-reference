import { formatPrice, type ExtraId } from '../data/products.ts';
import { addToCart, useCart } from '../lib/store.ts';
import { availableOn } from '../lib/cart-model.ts';
import Icon from './Icon';
import { useCatalog } from '../lib/catalog-client';
import type { CatalogSnapshot } from '../lib/catalog-types';

const sets: { productId: string; title: string; note: string; extras: ExtraId[] }[] = [
  { productId: 'cream-roses', title: 'Букет с открыткой', note: 'Кремовые розы + открытка', extras: ['postcard'] },
  { productId: 'pink-roses', title: 'Букет с вазой', note: 'Розовые розы + стеклянная ваза', extras: ['vase'] },
  { productId: 'pastel-mix', title: 'Полный набор', note: 'Пастельный микс + ваза + открытка', extras: ['vase', 'postcard'] },
];
export default function GiftSets({ initialCatalog }: { initialCatalog: CatalogSnapshot }) {
  const catalog = useCatalog(initialCatalog);
  const { products, extras } = catalog;
  const cart = useCart();
  return <div className="gift-grid">{sets.map((set, index) => {
    const product = products.find((item) => item.id === set.productId) ?? products[index % products.length];
    if (!product || set.extras.some(id => !extras.some(e => e.id === id))) return null;
    const price = product.prices.M + extras.filter((extra) => set.extras.includes(extra.id)).reduce((sum, extra) => sum + extra.price, 0);
    return <article className="gift-card" data-reveal key={set.title}>
      <div className="gift-photo"><a href={'/bouquet/' + product.id + '/'} aria-label={'Посмотреть букет: ' + product.name}><img src={product.image} alt={product.name} width="550" height="460" loading="lazy" style={{ objectPosition: product.imagePosition }} /></a><div className="gift-accessories">{set.extras.map((id) => <span className="gift-accessory" key={id} title={id === 'vase' ? 'Стеклянная ваза' : 'Открытка'}><Icon name={id === 'vase' ? 'vase' : 'card'} size={36} /></span>)}</div></div>
      <h3>{set.title}</h3><p>{product.name} + {extras.filter(e => set.extras.includes(e.id)).map(e => e.name.toLocaleLowerCase()).join(" + ")}</p>
      <div className="gift-bottom"><strong>{formatPrice(price)}</strong><button className="small-add-button" type="button" disabled={!availableOn(product.id, cart.date, catalog)} aria-label={'Добавить набор: ' + set.title} onClick={() => addToCart({ productId: product.id, size: 'M', extras: set.extras })}>В корзину <Icon name="plus" size={17} /></button></div>
    </article>;
  })}</div>;
}
