// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';

const SITE = 'https://siliconfeed.online';
/** SSR rubric pages are not always discovered by the crawler; keep sections indexable. */
const RUBRIC_SITEMAP_URLS = ['ai', 'hardware', 'open-source', 'other'].map(
  (slug) => `${SITE}/rubric/${slug}`
);

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Routes with `export const prerender = false` are SSR on Vercel; the rest is static.
  adapter: vercel(),
  integrations: [sitemap({ customPages: [...RUBRIC_SITEMAP_URLS, `${SITE}/search`] })],
  markdown: {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeSlug]
  }
});