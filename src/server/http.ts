import type { APIContext } from 'astro';
import { database, shopConfig } from './database.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
export async function handle(work: () => unknown | Promise<unknown>) {
  try { const result = await work(); return result instanceof Response ? result : json(result); }
  catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Flower request failed:', error instanceof Error ? error.name : 'Unknown error');
    return json({ error: 'Не удалось выполнить запрос. Попробуйте ещё раз.' }, 500);
  }
}
export function mutationGuard(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.FLOWER_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Отправьте запрос со страницы этого сайта.');
  }
}
export async function readJSON(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Ожидались данные формы.');
  if (Number(request.headers.get('content-length')) > 64000) throw new HttpError(413, 'Слишком большой запрос.');
  if (!request.body) throw new HttpError(400, 'Заполните форму.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length; if (length > 64000) { await reader.cancel(); throw new HttpError(413, 'Слишком большой запрос.'); }
    chunks.push(value);
  }
  try { const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8')); return object(data); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Некорректные данные формы.'); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Некорректные данные.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, min = 0, max = 500) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, 'Проверьте поле «' + label + '».');
  return value.trim();
}
export function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new HttpError(400, 'Проверьте поле «' + label + '».');
  return value;
}
export function boolean(value: unknown, label: string) { if (typeof value !== 'boolean') throw new HttpError(400, 'Проверьте поле «' + label + '».'); return value; }
export function phone(value: unknown, label: string) {
  const raw = text(value, label, 10, 24);
  if (!/^[+\d\s()\-]+$/.test(raw)) throw new HttpError(400, 'Проверьте номер телефона.');
  const digits = raw.replace(/\D/g, '');
  if (!/^[78]\d{10}$/.test(digits)) throw new HttpError(400, 'Укажите российский номер: +7 и десять цифр.');
  return '+7' + digits.slice(1);
}
export function clientKey(context: APIContext) {
  if (process.env.FLOWER_TRUST_PROXY === 'true') return context.request.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0, 80) || context.clientAddress;
  return context.clientAddress;
}
export function rateLimit(key: string, limit: number, duration: number) {
  const db = database(); const now = Date.now();
  db.prepare("DELETE FROM rate_limits WHERE reset_at<? AND key!='seed-complete'").run(now);
  const row = db.prepare('SELECT hits,reset_at FROM rate_limits WHERE key=?').get(key);
  if (row && Number(row.hits) >= limit) throw new HttpError(429, 'Слишком много попыток. Подождите несколько минут.');
  db.prepare('INSERT INTO rate_limits(key,hits,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1').run(key, now + duration);
}
export function intakeChecks(body: Record<string, unknown>) {
  if (body.website) throw new HttpError(400, 'Не удалось отправить форму.');
  if (body.consent !== true) throw new HttpError(400, 'Подтвердите согласие на связь по заявке.');
  if (shopConfig().settings.demoMode && body.demoAcknowledged !== true) throw new HttpError(400, 'Подтвердите, что это тестовая заявка.');
}
