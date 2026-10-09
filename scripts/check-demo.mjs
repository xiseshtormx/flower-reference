import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const root = resolve('dist-demo/client');
const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1) || 'flower-reference';
const base = '/' + repository + '/';
const origin = 'https://demo.invalid';
const files = [];
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) walk(path); else files.push(path);
  }
}
assert.ok(existsSync(root), 'Сначала выполните npm run build:demo.');
walk(root);
assert.ok(existsSync(resolve(root, '.nojekyll')));
let checked = 0;
function checkLink(value, source) {
  if (!value || /^(#|data:|https?:|tel:|mailto:|\/\/)/.test(value)) return;
  const pagePath = base + relative(root, source).replaceAll('\\', '/');
  const url = new URL(value, origin + pagePath);
  assert.ok(url.pathname.startsWith(base), `Адрес без /${repository}/: ${value} в ${relative(root, source)}`);
  const path = resolve(root, decodeURIComponent(url.pathname.slice(base.length)));
  assert.ok(path === root || path.startsWith(root + sep), 'Путь вне папки демоверсии.');
  assert.ok(existsSync(path.endsWith('/') ? path + 'index.html' : path) || existsSync(resolve(path, 'index.html')), `Не найден ресурс: ${value} в ${relative(root, source)}`);
  checked++;
}
const pages = files.filter(path => path.endsWith('.html'));
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.ok(html.includes('lang="ru"'), `Нет языка страницы: ${page}`);
  for (const match of html.matchAll(/\b(?:href|src|component-url|renderer-url)="([^"]*)"/g)) checkLink(match[1].replaceAll('&amp;', '&'), page);
}
for (const file of files.filter(path => path.endsWith('.css'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) checkLink(match[1], file);
}
for (const file of files.filter(path => path.endsWith('.js'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)) checkLink(match[1], file);
}
for (const page of ['index.html', 'cart/index.html', 'privacy/index.html', '404.html']) assert.ok(existsSync(resolve(root, page)), `Нет страницы ${page}`);
assert.ok(pages.some(path => relative(root, path).startsWith('bouquet/')), 'Нет страниц букетов.');
for (const file of files) {
  const path = relative(root, file).replaceAll('\\', '/');
  assert.ok(!/(^|\/)(admin|AdminApp|api|server|storage|\.env|node_modules)(\/|\.|$)/.test(path), `Закрытый файл в публикации: ${path}`);
  assert.ok(!/\.(sqlite|sqlite-wal|sqlite-shm|db|mjs)$/.test(path), `Серверный файл в публикации: ${path}`);
}
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
assert.ok(index.includes('Заявки не отправляются'), 'Нет уведомления о демонстрации.');
console.log(`Демоверсия проверена: ${pages.length} страниц, ${checked} ссылок и ресурсов. Админка, база и серверные файлы не публикуются.`);
