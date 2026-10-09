import { defaultSettings, type Product, type ShopSettings } from './catalog-types.ts';

export function todayISO(now = new Date(), timezone = defaultSettings.timezone): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'T12:00:00Z'))
    && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
function localHour(now: Date, settings: ShopSettings) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find(p => p.type === 'hour')?.value) + Number(parts.find(p => p.type === 'minute')?.value) / 60;
}
export function isWorkingDate(date: string, settings: ShopSettings, now = new Date()) {
  if (!validISODate(date)) return false;
  const today = todayISO(now, settings.timezone);
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay() || 7;
  return date >= today && date <= shiftDate(today, settings.bookingDays)
    && settings.workingDays.includes(weekday) && !settings.closedDates.includes(date);
}
export function availableSlots(date: string, settings: ShopSettings, now = new Date()) {
  if (!isWorkingDate(date, settings, now)) return [];
  if (date !== todayISO(now, settings.timezone)) return settings.timeSlots;
  const hour = localHour(now, settings);
  if (hour >= settings.sameDayCutoff) return [];
  return settings.timeSlots.filter(slot => {
    const [h, m] = slot.split('–')[1].split(':').map(Number);
    return h + m / 60 > hour + settings.sameDayLeadHours;
  });
}
export function productAvailable(product: Product | undefined, date: string, settings = defaultSettings, now = new Date()) {
  if (!product || !product.published || product.availability === 'unavailable') return false;
  if (!date) return true; // Date is mandatory when submitting the order.
  if (!isWorkingDate(date, settings, now) || !availableSlots(date, settings, now).length) return false;
  const lead = product.availability === 'preorder' ? Math.max(1, product.preparationDays) : product.preparationDays;
  return date >= shiftDate(todayISO(now, settings.timezone), lead);
}
export function availabilityLabel(product: Product, date: string, settings: ShopSettings) {
  if (product.availability === 'unavailable') return 'Временно нет в наличии';
  if (date && !productAvailable(product, date, settings)) return 'Недоступен на выбранную дату';
  if (product.availability === 'preorder' || product.preparationDays > 0) return 'Под заказ · подготовка ' + Math.max(1, product.preparationDays) + ' дн.';
  return productAvailable(product, todayISO(), settings) ? 'Можно заказать на сегодня' : 'Дату выберете при оформлении';
}
