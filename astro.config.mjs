import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

const pagesDemo = process.env.PUBLIC_FLOWER_DEMO === '1';
const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1) || 'flower-reference';
const owner = process.env.GITHUB_REPOSITORY_OWNER || 'xiseshtormx';
const publicPages = ['index.astro', 'cart.astro', 'privacy.astro', '404.astro', 'bouquet/[id].astro'];
const pagesIntegration = {
  name: 'flower-pages-demo',
  hooks: {
    'astro:route:setup': ({ route }) => {
      const component = route.component.replaceAll('\\', '/');
      route.prerender = publicPages.some(page => component.endsWith('/pages/' + page));
    },
  },
};

export default defineConfig({
  integrations: [react(), ...(pagesDemo ? [pagesIntegration] : [])],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  ...(pagesDemo ? { site: `https://${owner}.github.io`, base: '/' + repository, outDir: './dist-demo', trailingSlash: 'always' } : {}),
  vite: { ssr: { external: ['node:sqlite', 'sharp'] } },
});
