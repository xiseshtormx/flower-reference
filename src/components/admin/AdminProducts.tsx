import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/catalog-client';
import type { Product, Size } from '../../lib/catalog-types';
import { formatPrice } from '../../data/products';
import { errorMessage } from './AdminApp';

function newProduct(): Product {
  return { id: '', name: '', subtitle: '', description: '', composition: '', category: 'Сборные букеты', tone: 'Розовые', image: '', images: [], imagePosition: '50% 50%', photoSize: 'M', prices: { S: 2000, M: 3000, L: 4000 }, sizeDescriptions: { S: 'Небольшой букет', M: 'Средний букет', L: 'Большой букет' }, availability: 'preorder', preparationDays: 1, published: false, sortOrder: 50, version: 0, readyToday: false, label: '' };
}
function slug(name: string) {
  const map: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return [...name.toLocaleLowerCase('ru')].map(char => map[char] ?? char).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
}
export default function AdminProducts({ products, onSaved }: { products: Product[]; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const edit = (product: Product) => { setDraft(structuredClone(product)); setError(''); };
  useEffect(() => { if (draft && dialog.current && !dialog.current.open) dialog.current.showModal(); if (!draft && dialog.current?.open) dialog.current.close(); }, [Boolean(draft)]);
  const field = <K extends keyof Product>(key: K, value: Product[K]) => setDraft(current => current ? { ...current, [key]: value } : current);
  const selected = products.filter(p => (p.name + ' ' + p.id).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  return <>
    <div className="admin-section-heading"><div><p className="admin-kicker">АССОРТИМЕНТ</p><h1>Букеты</h1><p>{products.filter(p => p.published).length} опубликовано · {products.filter(p => !p.published).length} скрыто</p></div><button className="admin-button" onClick={() => edit(newProduct())}>Добавить букет</button></div>
    <label className="admin-search">Найти букет<input type="search" placeholder="Название или адрес страницы" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && !draft && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-product-grid">{selected.map(product => <article className="admin-product-card" key={product.id}><img src={product.image} alt={product.name} width="280" height="220" style={{ objectPosition: product.imagePosition }} /><div><span className={'admin-badge ' + (!product.published ? 'admin-badge-muted' : '')}>{product.published ? 'На сайте' : 'Скрыт'}</span><h2>{product.name}</h2><p>{formatPrice(product.prices.M)} · размер M</p><small>{product.availability === 'ready' ? 'В наличии' : product.availability === 'preorder' ? 'Под заказ' : 'Временно отсутствует'}</small><div className="admin-card-actions"><button className="admin-button admin-button-secondary" onClick={() => edit(product)}>Изменить</button><button className="admin-link" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('admin/products', 'PUT', { ...product, published: !product.published }); await onSaved(); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}>{product.published ? 'Скрыть' : 'Опубликовать'}</button></div></div></article>)}</div>
    {!selected.length && <p className="admin-empty">Букетов пока нет. Добавьте новую позицию или измените поиск.</p>}
    <dialog ref={dialog} className="admin-dialog" onCancel={event => { if (busy) event.preventDefault(); else setDraft(null); }} aria-labelledby="product-editor-title">
      {draft && <form onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await api('admin/products', 'PUT', draft); await onSaved(); setDraft(null); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}>
        <div className="admin-dialog-heading"><h2 id="product-editor-title">{draft.version ? 'Изменить букет' : 'Новый букет'}</h2><button type="button" className="admin-link" disabled={busy} onClick={() => setDraft(null)}>Закрыть</button></div>
        <fieldset disabled={busy} className="admin-fieldset">
          <div className="admin-two-columns"><label>Название<input required minLength={2} maxLength={100} value={draft.name} onChange={event => field('name', event.target.value)} onBlur={() => { if (!draft.version && !draft.id) field('id', slug(draft.name)); }} /></label><label>Адрес страницы<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={80} readOnly={draft.version > 0} value={draft.id} onChange={event => field('id', event.target.value)} /><small>Например: pink-peonies. После создания адрес сохраняется.</small></label></div>
          <label>Короткое описание<input maxLength={160} value={draft.subtitle} onChange={event => field('subtitle', event.target.value)} /></label>
          <label>Описание<textarea required minLength={10} maxLength={2000} rows={3} value={draft.description} onChange={event => field('description', event.target.value)} /></label>
          <label>Состав и оформление<textarea required minLength={3} maxLength={1000} rows={2} value={draft.composition} onChange={event => field('composition', event.target.value)} /></label>
          <div className="admin-two-columns"><label>Категория<select value={draft.category} onChange={event => field('category', event.target.value as Product['category'])}><option>Монобукеты</option><option>Сборные букеты</option></select></label><label>Оттенки<select value={draft.tone} onChange={event => field('tone', event.target.value as Product['tone'])}><option>Светлые</option><option>Розовые</option><option>Яркие</option></select></label></div>
          <h3>Размеры и цены</h3>
          {(['S', 'M', 'L'] as Size[]).map(size => <div className="admin-two-columns" key={size}><label>Цена {size}, ₽<input type="number" required min={100} max={2000000} value={draft.prices[size]} onChange={event => field('prices', { ...draft.prices, [size]: Number(event.target.value) })} /></label><label>Состав / объём {size}<input maxLength={300} value={draft.sizeDescriptions[size]} onChange={event => field('sizeDescriptions', { ...draft.sizeDescriptions, [size]: event.target.value })} placeholder="Например: 15 роз, высота около 45 см" /></label></div>)}
          <h3>Фотографии</h3><p className="admin-help">Первая фотография — обложка. До 6 снимков JPEG, PNG или WebP, каждый до 8 МБ. При загрузке снимки оптимизируются.</p>
          <div className="admin-photo-grid">{draft.images.map((image, index) => <div key={image}><img src={image} alt={'Фотография ' + (index + 1)} /><div>{index === 0 ? <small>Обложка</small> : <button className="admin-link" type="button" onClick={() => field('images', [image, ...draft.images.filter(url => url !== image)])}>На обложку</button>}<button type="button" className="admin-link" onClick={() => field('images', draft.images.filter(url => url !== image))}>Убрать</button></div></div>)}</div>
          <label className="admin-upload">Добавить фотографии<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={draft.images.length >= 6} onChange={async event => {
            const files = Array.from(event.target.files || []); event.target.value = '';
            if (files.length + draft.images.length > 6 || files.some(file => file.size > 8 * 1024 * 1024)) { setError('До 6 фотографий, каждая меньше 8 МБ.'); return; }
            setBusy(true); setError('');
            try { for (const file of files) { const response = await fetch('/api/admin/upload', { method: 'POST', body: file, credentials: 'same-origin', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': file.type } }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setDraft(current => current ? { ...current, images: [...current.images, result.image], image: current.image || result.image } : current); } }
            catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
          }} /></label>
          <div className="admin-two-columns"><label>Размер на фото<select value={draft.photoSize} onChange={event => field('photoSize', event.target.value as Size)}><option>S</option><option>M</option><option>L</option></select></label><label>Кадрирование<input pattern="[0-9]{1,3}% [0-9]{1,3}%" required value={draft.imagePosition} onChange={event => field('imagePosition', event.target.value)} /><small>50% 50% — по центру. Второе число меняет положение по высоте.</small></label></div>
          <h3>Продажа</h3><div className="admin-two-columns"><label>Доступность<select value={draft.availability} onChange={event => field('availability', event.target.value as Product['availability'])}><option value="ready">В наличии</option><option value="preorder">Под заказ</option><option value="unavailable">Временно отсутствует</option></select></label><label>Подготовка, дней<input type="number" min={0} max={30} required value={draft.preparationDays} onChange={event => field('preparationDays', Number(event.target.value))} /><small>Для «Под заказ» минимум один день.</small></label></div>
          <div className="admin-two-columns"><label>Метка на карточке<input maxLength={40} value={draft.label || ''} onChange={event => field('label', event.target.value)} placeholder="Необязательно" /></label><label>Порядок в каталоге<input type="number" min={0} max={10000} required value={draft.sortOrder} onChange={event => field('sortOrder', Number(event.target.value))} /><small>Меньшее число — выше в каталоге.</small></label></div>
          <label className="admin-check"><input type="checkbox" checked={draft.published} onChange={event => field('published', event.target.checked)} />Показать на сайте</label>
        </fieldset>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-form-actions"><button className="admin-button" disabled={busy || !draft.images.length}>{busy ? 'Сохраняем…' : 'Сохранить букет'}</button><button className="admin-button admin-button-secondary" type="button" disabled={busy} onClick={() => setDraft(null)}>Отмена</button></div>
      </form>}
    </dialog>
  </>;
}
