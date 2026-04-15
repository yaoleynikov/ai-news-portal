import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import { getAstroSitemapCustomPages } from './src/lib/sitemap-config';

// https://astro.build/config
export default defineConfig({
  site: 'https://siliconfeed.online',
  // Routes with `export const prerender = false` are SSR on Vercel; the rest is static.
  adapter: vercel(),
  integrations: [sitemap({ customPages: getAstroSitemapCustomPages() })],
  markdown: {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeSlug]
  }
});
