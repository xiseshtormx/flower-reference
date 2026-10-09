import { useEffect, useRef, useState } from 'react';
import { formatPrice, type Product } from '../data/products.ts';
import { useCart, useFavorites, toggleFavorite, addToCart } from '../lib/store.ts';
import { availableOn, todayISO } from '../lib/cart-model.ts';
import Icon from './Icon';
import { useCatalog } from '../lib/catalog-client';
import type { CatalogSnapshot } from '../lib/catalog-types';
import { availabilityLabel, productAvailable } from '../lib/availability';

function ProductCard({ product, date, favorite, catalog }: { product: Product; date: string; favorite: boolean; catalog: CatalogSnapshot }) {
  const available = availableOn(product.id, date, catalog);
  return <article className="product-card" data-reveal>
    <div className="product-image-wrap">
      <a href={'/bouquet/' + product.id + '/'} aria-label={'Подробнее: ' + product.name}>
        <img src={product.image} alt={product.name + ', размер ' + product.photoSize} width="550" height="688" loading="lazy" decoding="async" style={{ objectPosition: product.imagePosition }} />
      </a>
      {product.label && <span className="product-label">{product.label}</span>}
      <button type="button" className={'favorite-button' + (favorite ? ' is-favorite' : '')} aria-label={(favorite ? 'Убрать из избранного: ' : 'Добавить в избранное: ') + product.name} aria-pressed={favorite} onClick={() => toggleFavorite(product.id)}><Icon name="heart" size={18} /></button>
    </div>
    <h3><a href={'/bouquet/' + product.id + '/'}>{product.name}</a></h3>
    <p className="product-subtitle">{product.subtitle}{product.photoSize !== "M" ? " · На фото размер " + product.photoSize : ""}</p>
    <div className="product-card-bottom">
      <strong>{formatPrice(product.prices.M)}</strong>
      <button type="button" className="small-add-button" disabled={!available} aria-label={'Добавить в корзину: ' + product.name} onClick={() => addToCart({ productId: product.id, size: 'M', extras: [] })}><span>В корзину</span><Icon name="plus" size={17} /></button>
    </div>
    <p className={'availability' + (!available ? ' unavailable' : '')}><span className="status-dot" />{availabilityLabel(product, date, catalog.settings)}</p>
  </article>;
}

export default function Catalog({ initialCatalog }: { initialCatalog: CatalogSnapshot }) {
  const catalog = useCatalog(initialCatalog);
  const products = catalog.products;
  const cart = useCart();
  const favorites = useFavorites();
  const [category, setCategory] = useState('Все букеты');
  const [budget, setBudget] = useState('all');
  const [tone, setTone] = useState('Все оттенки');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('selection');
  const [onlyToday, setOnlyToday] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const filtersButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let stored = '';
    try { stored = window.sessionStorage.getItem('flower-reference-filters') ?? ''; } catch {}
    const query = new URLSearchParams(window.location.search || stored);
    const selectedCategory = query.get('category') ?? '';
    const selectedBudget = query.get('budget') ?? '';
    const selectedTone = query.get('tone') ?? '';
    const selectedSort = query.get('sort') ?? '';
    if (['Монобукеты', 'Сборные букеты'].includes(selectedCategory)) setCategory(selectedCategory);
    if (['under3000', '3000to5000', 'over5000'].includes(selectedBudget)) setBudget(selectedBudget);
    if (['Светлые', 'Розовые', 'Яркие'].includes(selectedTone)) setTone(selectedTone);
    if (['ascending', 'descending'].includes(selectedSort)) setSort(selectedSort);
    setOnlyFavorites(query.get('favorites') === '1');
    setOnlyToday(query.get('today') === '1');
    setSearch(query.get('q') ?? '');
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const query = new URLSearchParams();
    if (category !== 'Все букеты') query.set('category', category);
    if (budget !== 'all') query.set('budget', budget);
    if (tone !== 'Все оттенки') query.set('tone', tone);
    if (sort !== 'selection') query.set('sort', sort);
    if (onlyFavorites) query.set('favorites', '1');
    if (onlyToday) query.set('today', '1');
    if (search) query.set('q', search);
    const serialized = query.toString();
    try { window.sessionStorage.setItem('flower-reference-filters', serialized); } catch {}
    window.history.replaceState(window.history.state, '', window.location.pathname + (serialized ? '?' + serialized : '') + window.location.hash);
  }, [restored, category, budget, tone, sort, onlyFavorites, onlyToday, search]);
  useEffect(() => {
    const dialog = filterDialog.current;
    if (filtersOpen && dialog && !dialog.open) dialog.showModal();
    else if (!filtersOpen && dialog?.open) dialog.close();
  }, [filtersOpen]);
  const futureDate = Boolean(cart.date && cart.date > todayISO());
  const selected = products.filter((product) => {
    const price = product.prices.M;
    return (category === 'Все букеты' || product.category === category)
      && (budget === 'all' || budget === 'under3000' && price <= 3000 || budget === '3000to5000' && price > 3000 && price <= 5000 || budget === 'over5000' && price > 5000)
      && (tone === 'Все оттенки' || product.tone === tone)
      && (!onlyToday || futureDate || productAvailable(product, todayISO(), catalog.settings))
      && (!onlyFavorites || favorites.includes(product.id))
      && (product.name + ' ' + product.subtitle + ' ' + product.composition).toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'));
  }).sort((a, b) => sort === 'ascending' ? a.prices.M - b.prices.M : sort === 'descending' ? b.prices.M - a.prices.M : 0);
  const reset = () => { setCategory('Все букеты'); setBudget('all'); setTone('Все оттенки'); setSearch(''); setOnlyToday(false); setOnlyFavorites(false); setSort('selection'); };
  const activeFilters = [
    ...(category !== 'Все букеты' ? [{ label: category, clear: () => setCategory('Все букеты') }] : []),
    ...(budget !== 'all' ? [{ label: budget === 'under3000' ? 'До 3 000 ₽' : budget === '3000to5000' ? '3 001–5 000 ₽' : 'От 5 001 ₽', clear: () => setBudget('all') }] : []),
    ...(tone !== 'Все оттенки' ? [{ label: tone, clear: () => setTone('Все оттенки') }] : []),
    ...(onlyToday && !futureDate ? [{ label: 'Сегодня', clear: () => setOnlyToday(false) }] : []),
    ...(onlyFavorites ? [{ label: 'Избранное', clear: () => setOnlyFavorites(false) }] : []),
    ...(search.trim() ? [{ label: 'Поиск: ' + search.trim(), clear: () => setSearch('') }] : []),
  ];
  const filterFields = (prefix: string) => <>
    <label className="filter-field"><span>Бюджет</span><select value={budget} onChange={(event) => setBudget(event.target.value)} id={prefix + '-budget'}><option value="all">Любая цена</option><option value="under3000">До 3 000 ₽</option><option value="3000to5000">3 001–5 000 ₽</option><option value="over5000">От 5 001 ₽</option></select></label>
    <label className="filter-field"><span>Оттенки</span><select value={tone} onChange={(event) => setTone(event.target.value)} id={prefix + '-tone'}>{['Все оттенки', 'Светлые', 'Розовые', 'Яркие'].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="check-field"><input type="checkbox" disabled={futureDate} checked={onlyToday && !futureDate} onChange={(event) => setOnlyToday(event.target.checked)} /><span>Доступно сегодня</span></label>
    {futureDate && <p className="muted filter-note">Доступность зависит от даты и времени подготовки.</p>}
  </>;
  const activeCount = Number(budget !== 'all') + Number(tone !== 'Все оттенки') + Number(onlyToday && !futureDate);
  return <div className="catalog-app">
    <div className="catalog-tabs" role="group" aria-label="Вид букета">
      {['Все букеты', 'Монобукеты', 'Сборные букеты'].map((value) => <button key={value} type="button" className={category === value ? 'is-active' : ''} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
      <button type="button" className={'favorites-filter' + (onlyFavorites ? ' is-active' : '')} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}><Icon name="heart" size={16} />Избранное{favorites.length > 0 ? ' (' + favorites.length + ')' : ''}</button>
    </div>
    <div className="catalog-toolbar">
      <div className="desktop-filters">{filterFields('desktop')}</div>
      <button ref={filtersButton} type="button" className="mobile-filter-button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}><Icon name="sliders" size={18} />Фильтры{activeCount > 0 ? ' · ' + activeCount : ''}</button>
      <label className="catalog-search"><Icon name="search" size={18} /><span className="sr-only">Поиск букетов</span><input id="catalog-search" type="search" placeholder="Название или цветы" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </div>
    <div className="catalog-results-bar">
      <span role="status" aria-live="polite">{selected.length} из {products.length} букетов</span>
      <label className="sort-field"><span className="sr-only">Сортировка</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="selection">Выбор мастерской</option><option value="ascending">Сначала дешевле</option><option value="descending">Сначала дороже</option></select></label>
    </div>
    {activeFilters.length > 0 && <div className="active-filters" aria-label="Выбранные фильтры">{activeFilters.map((filter) => <button key={filter.label} type="button" onClick={filter.clear} aria-label={'Убрать фильтр: ' + filter.label}>{filter.label}<Icon name="close" size={13} /></button>)}<button type="button" className="clear-all-filters" onClick={reset}>Сбросить всё</button></div>}
    {selected.length ? <div className="product-grid">{selected.map((product) => <ProductCard key={product.id} product={product} date={cart.date} favorite={favorites.includes(product.id)} catalog={catalog} />)}</div> : <div className="empty-results"><Icon name={onlyFavorites ? 'heart' : 'search'} size={36} /><h3>{onlyFavorites ? 'Пока нет подходящих избранных' : 'Таких букетов пока нет'}</h3><p>Попробуйте другой бюджет или оттенок. Понравившиеся букеты можно сохранить с помощью сердечка.</p><button className="button button-secondary" type="button" onClick={reset}>Сбросить фильтры</button></div>}
    <dialog ref={filterDialog} className="filter-dialog" aria-labelledby="filter-title" onCancel={() => setFiltersOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}>
      <div className="dialog-content"><div className="dialog-heading"><h2 id="filter-title">Фильтры</h2><button type="button" className="icon-button" aria-label="Закрыть фильтры" onClick={() => setFiltersOpen(false)}><Icon name="close" /></button></div><div className="mobile-filter-fields">{filterFields('mobile')}</div><button className="button button-primary full-width" type="button" onClick={() => { setFiltersOpen(false); filtersButton.current?.focus(); }}>Показать букеты ({selected.length})</button><button type="button" className="text-button" onClick={reset}>Сбросить</button></div>
    </dialog>
  </div>;
}
