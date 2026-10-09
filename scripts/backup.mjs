import { backup } from 'node:sqlite';
import { mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { database, storagePath } from '../src/server/database.ts';
const destination = join(storagePath(), 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(destination, { recursive: true });
await backup(database(), join(destination, 'flower.sqlite'));
await cp(join(storagePath(), 'uploads'), join(destination, 'uploads'), { recursive: true });
console.log('Резервная копия базы и фотографий: ' + destination);
