import { useRef, useEffect, useState } from 'react';
import { type Product, type Size, type ExtraId, sizes, formatPrice } from '../data/products.ts';
import { addToCart, useCart, useFavorites, toggleFavorite } from '../lib/store.ts';
import { availableOn, dateLabel } from '../lib/cart-model.ts';
import Icon from './Icon';
import { useCatalog } from '../lib/catalog-client';
import type { CatalogSnapshot } from '../lib/catalog-types';
import { availabilityLabel } from '../lib/availability';

export default function ProductView({ product: initialProduct, initialCatalog }: { product: Product; initialCatalog: CatalogSnapshot }) {
  const catalog = useCatalog(initialCatalog);
  const product = catalog.products.find(p => p.id === initialProduct.id) ?? initialProduct;
  const extras = catalog.extras;
  const [photo, setPhoto] = useState(0);
  const image = product.images[photo] ?? product.image;
  const [size, setSize] = useState<Size>(initialProduct.photoSize);
  const [selectedExtras, setSelectedExtras] = useState<ExtraId[]>([]);
  const [zoom, setZoom] = useState(false);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const cart = useCart();
  const favorites = useFavorites();
  const favorite = favorites.includes(product.id);
  const total = product.prices[size] + extras.filter((extra) => selectedExtras.includes(extra.id)).reduce((sum, extra) => sum + extra.price, 0);
  const available = availableOn(product.id, cart.date, catalog);
  useEffect(() => {
    if (zoom && zoomRef.current && !zoomRef.current.open) zoomRef.current.showModal();
    else if (!zoom && zoomRef.current?.open) zoomRef.current.close();
  }, [zoom]);
  return <div className="product-detail">
    <div className="detail-photo-column">
      <button className="detail-photo" type="button" aria-label="Увеличить фотографию букета" onClick={() => setZoom(true)}><img src={image} alt={product.name + ', размер ' + product.photoSize} width="1100" height="1375" fetchPriority="high" style={{ objectPosition: product.imagePosition }} /><span className="zoom-caption"><Icon name="plus" size={16} />Рассмотреть букет</span></button>
      {product.images.length > 1 && <div className="photo-thumbnails" aria-label="Фотографии букета">{product.images.map((url, index) => <button type="button" key={url} aria-label={"Фотография " + (index + 1)} aria-pressed={photo === index} onClick={() => setPhoto(index)}><img src={url} alt="" width="64" height="76" /></button>)}</div>}
      <div className="photo-note"><span>Фотография букета</span><span>На фото размер {product.photoSize}</span></div>
    </div>
    <div className="detail-info">
      <div className="detail-category"><span className="eyebrow">{product.category}</span><button className={'icon-button favorite-button-inline' + (favorite ? ' is-favorite' : '')} type="button" aria-pressed={favorite} aria-label={favorite ? 'Убрать букет из избранного' : 'Сохранить букет в избранное'} onClick={() => toggleFavorite(product.id)}><Icon name="heart" /></button></div>
      <h1>{product.name}</h1>
      <p className="detail-intro">{product.description}</p>
      <fieldset className="size-fieldset"><legend>Размер букета</legend><div className="size-options">{sizes.map((variant) => <label key={variant.id} className={size === variant.id ? 'selected' : ''}><input type="radio" name="bouquet-size" value={variant.id} checked={size === variant.id} onChange={() => setSize(variant.id)} /><span className="size-letter">{variant.id}</span><span>{variant.label}</span><strong>{formatPrice(product.prices[variant.id])}</strong></label>)}</div><p className="muted size-description">{product.sizeDescriptions[size]}</p></fieldset>
      <fieldset className="extras-fieldset"><legend>Добавить к букету</legend>{extras.map((extra) => <label key={extra.id} className="extra-option"><span className="extra-icon"><Icon name={extra.symbol} size={25} /></span><span className="extra-description"><strong>{extra.name}</strong><small>{extra.description}</small></span><span className="extra-price">+ {formatPrice(extra.price)}</span><input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={(event) => setSelectedExtras(event.target.checked ? [...selectedExtras, extra.id] : selectedExtras.filter((id) => id !== extra.id))} /></label>)}</fieldset>
      <div className="detail-purchase"><div><span className="muted">Букет{selectedExtras.length ? ' и дополнения' : ''}</span><strong aria-live="polite">{formatPrice(total)}</strong></div><button className="button button-primary" type="button" disabled={!available} onClick={() => addToCart({ productId: product.id, size, extras: selectedExtras })}>В корзину <Icon name="bag" /></button></div>
      <p className={'availability detail-availability' + (!available ? ' unavailable' : '')}><span className="status-dot" />{catalog.products.some(p => p.id === product.id) ? availabilityLabel(product, cart.date, catalog.settings) + (cart.date ? ' · ' + dateLabel(cart.date) : '') : 'Этот букет больше не продаётся'}</p>
      <div className="detail-accordion">
        <details open><summary>Состав и оформление<span>+</span></summary><p>{product.composition} Состав сезонного букета может немного отличаться. На фотографии размер {product.photoSize}. Другие размеры отличаются объёмом.</p></details>
        <details><summary>Доставка и самовывоз<span>+</span></summary><p>{catalog.settings.courierEnabled && <>Курьером по Перми — {formatPrice(catalog.settings.deliveryPrice)}. </>}{catalog.settings.pickupEnabled && <>Самовывоз бесплатный. {catalog.settings.pickupAddress} </>}Дату и временной интервал укажете в корзине. После заявки флорист подтвердит состав и время.</p></details>
        <details><summary>Как ухаживать за цветами<span>+</span></summary><p>Поставьте букет в чистую вазу, обновите срезы и регулярно меняйте воду. Выберите прохладное место вдали от прямого солнца и батареи.</p></details>
      </div>
    </div>
    <dialog ref={zoomRef} className="zoom-dialog" aria-label="Увеличенная фотография букета" onCancel={() => setZoom(false)} onClick={(event) => { if (event.target === event.currentTarget) setZoom(false); }}><button className="zoom-close icon-button" aria-label="Закрыть фотографию" type="button" onClick={() => setZoom(false)}><Icon name="close" /></button><img src={image} alt={product.name + ', увеличенная фотография'} width="1100" height="1375" /></dialog>
  </div>;
}
