import { useRef, useState } from 'react';
import Icon from './Icon';
import { formatPrice } from '../data/products.ts';
import type { CatalogSnapshot } from '../lib/catalog-types.ts';
import { useCatalog, api, type Receipt } from '../lib/catalog-client.ts';
import { todayISO, shiftDate } from '../lib/availability.ts';

export default function RequestForm({ initialCatalog }: { initialCatalog: CatalogSnapshot }) {
  const { settings } = useCatalog(initialCatalog);
  const [budget, setBudget] = useState('4000');
  const [contactMethod, setContactMethod] = useState<'phone' | 'telegram'>('phone');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const attempt = useRef({ signature: '', key: '' });
  return receipt ? <div className="request-result" role="status"><Icon name="check" size={32} /><h3>Заявка {receipt.number} получена</h3><p>Бюджет: {formatPrice(Number(budget))}.</p><p className="muted">{receipt.demo ? 'Тестовая заявка сохранена в панели управления. Это учебный проект.' : 'Флорист свяжется с вами, предложит состав и согласует стоимость.'}</p><button className="text-button" type="button" onClick={() => { setReceipt(null); attempt.current = { signature: '', key: '' }; }}>Оставить ещё одну заявку</button></div> : <form className="request-form" data-reveal onSubmit={async event => {
    event.preventDefault(); if (sending) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '');
    const body = { budget: Number(budget), date: value('date'), buyerName: value('name'), contactMethod, contact: value('contact'), comment: value('wishes'), consent: fields.get('consent') === 'on', demoAcknowledged: fields.get('demoAcknowledged') === 'on', website: value('website') };
    const signature = JSON.stringify(body);
    if (attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setSending(true); setError('');
    try { setReceipt(await api<Receipt>('requests', 'POST', body, attempt.current.key)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось отправить заявку. Попробуйте ещё раз.'); }
    finally { setSending(false); }
  }}>
    <fieldset className="form-fields-reset" disabled={sending}>
      <div className="form-grid"><label className="form-field"><span>Ваш бюджет, ₽</span><input type="number" min="1500" max="2000000" step="1" required value={budget} onChange={event => setBudget(event.target.value)} /></label><label className="form-field"><span>Желаемая дата</span><input name="date" type="date" min={todayISO()} max={shiftDate(todayISO(), settings.bookingDays)} required /></label></div>
      <label className="form-field"><span>Что вам нравится?</span><textarea name="wishes" placeholder="Например: светлые цветы, свободная форма, без роз" rows={3} maxLength={1000} /></label>
      <label className="form-field"><span>Ваше имя</span><input name="name" autoComplete="given-name" required minLength={2} maxLength={80} placeholder="Как к вам обращаться" /></label>
      <div className="form-grid"><label className="form-field"><span>Как связаться</span><select value={contactMethod} onChange={event => setContactMethod(event.target.value as 'phone' | 'telegram')}><option value="phone">По телефону</option><option value="telegram">В Telegram</option></select></label><label className="form-field"><span>{contactMethod === 'phone' ? 'Телефон' : 'Имя в Telegram'}</span><input key={contactMethod} name="contact" type={contactMethod === 'phone' ? 'tel' : 'text'} placeholder={contactMethod === 'phone' ? '+7 999 123-45-67' : '@username'} required minLength={contactMethod === 'phone' ? 10 : 5} maxLength={33} /></label></div>
      <label className="check-field consent-field"><input type="checkbox" name="consent" required /><span>Можно связаться со мной по заявке. <a href="/privacy/" target="_blank" rel="noopener">Как используются данные</a></span></label>
      {settings.demoMode && <label className="check-field consent-field"><input type="checkbox" name="demoAcknowledged" required /><span>Это тестовая заявка. Использую тестовые контакты.</span></label>}
      <label className="form-trap" aria-hidden="true">Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="button button-primary full-width" type="submit">{sending ? 'Отправляем…' : 'Отправить пожелания'}</button>
    </fieldset>
    {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
    <p className="request-demo-note">{settings.demoMode ? 'Пожелания сохранятся как тестовая заявка в панели.' : 'Состав, стоимость и дату согласуем с вами перед подтверждением.'}</p>
  </form>;
}
