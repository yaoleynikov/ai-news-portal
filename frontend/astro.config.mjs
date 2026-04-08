// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';

// https://astro.build/config
export default defineConfig({
  site: 'https://siliconfeed.online',
  // Astro 5+: маршруты с `export const prerender = false` — SSR на Vercel; остальное статика.
  adapter: vercel(),
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeSlug]
  }
});