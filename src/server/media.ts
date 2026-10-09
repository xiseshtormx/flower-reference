import sharp from 'sharp';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { database, storagePath } from './database.ts';
import { HttpError } from './http.ts';

export async function uploadImage(request: Request) {
  const limit = 8 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit || !request.body) throw new HttpError(413, 'Фотография должна быть меньше 8 МБ.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length; if (length > limit) { await reader.cancel(); throw new HttpError(413, 'Фотография должна быть меньше 8 МБ.'); } chunks.push(value);
  }
  let image: Buffer;
  try {
    const source = sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 });
    const metadata = await source.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('Invalid image');
    image = await source.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new HttpError(400, 'Загрузите обычную фотографию JPEG, PNG или WebP до 40 мегапикселей.'); }
  const filename = randomUUID() + '.webp'; const db = database();
  await writeFile(join(storagePath(), 'uploads', filename), image, { flag: 'wx' });
  db.prepare('INSERT INTO media VALUES (?,?,?)').run(filename, 'image/webp', new Date().toISOString());
  return { image: '/media/' + filename };
}
export async function serveImage(filename: string | undefined) {
  if (!filename || !/^[a-f0-9-]{36}\.webp$/.test(filename) || !database().prepare('SELECT filename FROM media WHERE filename=?').get(filename)) return new Response('Not found', { status: 404 });
  try {
    const bytes = await readFile(join(storagePath(), 'uploads', filename));
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Not found', { status: 404 }); }
}
