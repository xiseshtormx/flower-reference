import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { products, extras } from '../data/products.ts';
import { defaultSettings, type Product, type ShopSettings, type CatalogSnapshot, type Extra, type OrderRecord } from '../lib/catalog-types.ts';

export const storagePath = () => resolve(process.env.FLOWER_STORAGE_DIR || './storage');
const databases = new Map<string, DatabaseSync>();
export function database() {
  const directory = storagePath();
  const file = join(directory, 'flower.sqlite');
  if (databases.has(file)) return databases.get(file)!;
  mkdirSync(join(directory, 'uploads'), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, status TEXT NOT NULL,
      date TEXT NOT NULL, total INTEGER, final_total INTEGER, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, body_hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS order_date ON orders(date, status);
    CREATE TABLE IF NOT EXISTS order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), at TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (order_id INTEGER PRIMARY KEY REFERENCES orders(id), state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media (filename TEXT PRIMARY KEY, mime TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT OR IGNORE INTO meta VALUES (1, 1);`);
  db.prepare('INSERT OR IGNORE INTO settings(id,data,version) VALUES (1,?,1)').run(JSON.stringify({ settings: defaultSettings, extras }));
  // Seed once. An intentionally empty catalog remains empty after a restart.
  const marker = db.prepare("SELECT key FROM rate_limits WHERE key='seed-complete'").get();
  if (!marker) {
    transaction(db, () => {
      const insert = db.prepare('INSERT OR IGNORE INTO products(id,data,version) VALUES (?,?,1)');
      products.forEach(product => insert.run(product.id, JSON.stringify(product)));
      db.prepare("INSERT INTO rate_limits VALUES ('seed-complete',0,9223372036854775807)").run();
    });
  }
  databases.set(file, db);
  return db;
}
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function allProducts(): Product[] {
  return database().prepare('SELECT data,version FROM products').all().map(row => ({ ...JSON.parse(String(row.data)), version: Number(row.version) })).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'));
}
export function shopConfig(): { settings: ShopSettings; extras: Extra[]; version: number } {
  const row = database().prepare('SELECT data,version FROM settings WHERE id=1').get()!;
  return { ...JSON.parse(String(row.data)), version: Number(row.version) };
}
export function publicCatalog(): CatalogSnapshot {
  const config = shopConfig();
  const fullDates = database().prepare("SELECT date FROM orders WHERE status!='cancelled' AND (kind='catalog' OR status!='new') GROUP BY date HAVING COUNT(*)>=?").all(config.settings.dailyCapacity).map(row => String(row.date));
  const settings = { ...config.settings, closedDates: [...new Set([...config.settings.closedDates, ...fullDates])] };
  return { products: allProducts().filter(p => p.published), extras: config.extras.filter(e => e.enabled), settings,
    revision: Number(database().prepare('SELECT revision FROM meta WHERE id=1').get()!.revision), serverTime: new Date().toISOString() };
}
export function bumpRevision() { database().prepare('UPDATE meta SET revision=revision+1 WHERE id=1').run(); }
export function bookingsOn(date: string) {
  return Number(database().prepare("SELECT COUNT(*) AS count FROM orders WHERE date=? AND status!='cancelled' AND (kind='catalog' OR status!='new')").get(date)!.count);
}
export function getOrder(id: number): OrderRecord | undefined {
  const db = database();
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!row) return;
  const notification = db.prepare('SELECT state,attempts FROM notifications WHERE order_id=?').get(id);
  return {
    id, number: 'FL-' + String(id).padStart(6, '0'), kind: row.kind as OrderRecord['kind'], status: row.status as OrderRecord['status'],
    date: String(row.date), total: row.total === null ? null : Number(row.total), finalTotal: row.final_total === null ? null : Number(row.final_total),
    data: JSON.parse(String(row.data)), version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    events: db.prepare('SELECT at,status,note FROM order_events WHERE order_id=? ORDER BY id').all(id) as unknown as OrderRecord['events'],
    notification: notification ? { state: String(notification.state), attempts: Number(notification.attempts) } : null,
  };
}
export function resetConnections() { databases.forEach(db => db.close()); databases.clear(); }
