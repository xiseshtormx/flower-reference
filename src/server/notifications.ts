import { database, transaction, getOrder } from './database.ts';
import { HttpError } from './http.ts';

export const telegramConfigured = () => Boolean(process.env.FLOWER_TELEGRAM_BOT_TOKEN && process.env.FLOWER_TELEGRAM_CHAT_ID);
let running = false;
export async function deliverNotifications(transport: typeof fetch = fetch) {
  if (running || !telegramConfigured()) return;
  running = true;
  try {
    for (let i = 0; i < 5; i++) {
      const db = database(); const now = Date.now();
      const row = transaction(db, () => {
        const candidate = db.prepare("SELECT order_id,attempts FROM notifications WHERE state='pending' AND attempts<5 AND next_at<=? AND lease_until<=? ORDER BY order_id LIMIT 1").get(now, now);
        if (candidate) db.prepare('UPDATE notifications SET attempts=attempts+1,lease_until=? WHERE order_id=?').run(now + 30000, candidate.order_id);
        return candidate;
      });
      if (!row) break;
      const order = getOrder(Number(row.order_id))!;
      // Contact details stay in the private admin panel, not in chat notifications.
      const message = `${order.data.demo ? '[ТЕСТ] ' : ''}Новая заявка ${order.number}\n${order.kind === 'custom' ? 'Индивидуальный букет' : 'Букеты из каталога'}\nДата: ${order.date}\n${order.total === null ? 'Бюджет: ' + order.data.budget : 'Сумма: ' + order.total} ₽\nОткройте панель управления для обработки.`;
      try {
        const response = await transport('https://api.telegram.org/bot' + process.env.FLOWER_TELEGRAM_BOT_TOKEN + '/sendMessage', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.FLOWER_TELEGRAM_CHAT_ID, text: message }), signal: AbortSignal.timeout(8000),
        });
        const result = await response.json() as { ok?: boolean };
        if (!response.ok || !result.ok) throw new Error('Notification failed');
        db.prepare("UPDATE notifications SET state='sent',lease_until=0 WHERE order_id=?").run(order.id);
      } catch {
        const attempts = Number(row.attempts) + 1;
        db.prepare('UPDATE notifications SET state=?,lease_until=0,next_at=? WHERE order_id=?').run(attempts >= 5 ? 'failed' : 'pending', now + Math.min(3600000, 60000 * 2 ** attempts), order.id);
      }
    }
  } finally { running = false; }
}
export function retryNotification(id: number) {
  if (!telegramConfigured()) throw new HttpError(400, 'Сначала подключите Telegram в .env и перезапустите сервер.');
  if (!getOrder(id)) throw new HttpError(404, 'Заказ не найден.');
  const row = database().prepare('SELECT state,lease_until FROM notifications WHERE order_id=?').get(id);
  if (row && Number(row.lease_until) > Date.now()) throw new HttpError(409, 'Уведомление уже отправляется.');
  database().prepare("INSERT INTO notifications(order_id,state,next_at) VALUES (?,'pending',?) ON CONFLICT(order_id) DO UPDATE SET state='pending',attempts=0,next_at=excluded.next_at,lease_until=0").run(id, Date.now());
}
