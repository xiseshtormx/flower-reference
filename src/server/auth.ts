import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { APIContext } from 'astro';
import { database } from './database.ts';
import { HttpError } from './http.ts';

const cookieName = 'flower_admin';
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function authConfigured() { return Boolean(process.env.FLOWER_ADMIN_LOGIN && /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(process.env.FLOWER_ADMIN_PASSWORD_HASH || '')); }
export function authenticate(login: unknown, password: unknown) {
  if (!authConfigured()) throw new HttpError(503, 'Доступ ещё не настроен. Выполните npm run setup в папке проекта.');
  if (typeof password !== 'string' || !password.length || password.length > 200) throw new HttpError(400, 'Введите пароль.');
  const candidate = password;
  const [salt, digest] = process.env.FLOWER_ADMIN_PASSWORD_HASH!.split(':');
  const matches = timingSafeEqual(scryptSync(candidate, salt, 64), Buffer.from(digest, 'hex'));
  if (!matches || typeof login !== 'string' || login.trim() !== process.env.FLOWER_ADMIN_LOGIN) throw new HttpError(401, 'Неверный логин или пароль.');
  return true;
}
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function loggedIn(context: APIContext) {
  if (!authConfigured()) return false;
  const token = context.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const now = Date.now(); const db = database();
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
  return Boolean(db.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token), now));
}
export function requireAdmin(context: APIContext) {
  if (!loggedIn(context)) throw new HttpError(401, 'Войдите в панель управления.');
}
export function createSession(context: APIContext) {
  const token = randomBytes(32).toString('hex');
  database().prepare('INSERT INTO sessions VALUES (?,?)').run(hashToken(token), Date.now() + 8 * 3600000);
  context.cookies.set(cookieName, token, { httpOnly: true, secure: context.url.protocol === 'https:' || process.env.FLOWER_COOKIE_SECURE === 'true', sameSite: 'strict', path: '/', maxAge: 8 * 3600 });
}
export function endSession(context: APIContext) {
  const token = context.cookies.get(cookieName)?.value;
  if (token) database().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
  context.cookies.delete(cookieName, { path: '/' });
}
