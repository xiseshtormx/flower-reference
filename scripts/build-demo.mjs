import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const result = spawnSync(process.execPath, ['./node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_FLOWER_DEMO: '1' },
});
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync('dist-demo/client/index.html')) {
  console.error('Демонстрационная страница не собрана. Проверьте astro.config.mjs.');
  process.exit(1);
}
// The Node adapter also emits client assets for the local admin route.
// They are unnecessary on Pages; retain every shared storefront chunk.
const staticHTML = [];
function readPages(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = folder + '/' + entry.name;
    if (entry.isDirectory()) readPages(path);
    else if (entry.name.endsWith('.html')) staticHTML.push(readFileSync(path, 'utf8'));
  }
}
readPages('dist-demo/client');
for (const name of readdirSync('dist-demo/client/_astro')) {
  if (!/^(AdminApp|admin)\.[^.]+\.(js|css)$/.test(name)) continue;
  if (staticHTML.some(html => html.includes(name))) {
    console.error('Страница демоверсии использует ресурс админки: ' + name);
    process.exit(1);
  }
  rmSync('dist-demo/client/_astro/' + name);
}
writeFileSync('dist-demo/client/.nojekyll', '');
console.log('Демоверсия готова: dist-demo/client. На GitHub Pages публикуется только эта папка.');
