import type { APIRoute } from 'astro';
import { listAllPublishedSlugs } from '../lib/articles-db';

export const prerender = false;

/** Отдельный sitemap только для /news/* — удобно подключать в Search Console. */
export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? 'https://siliconfeed.online/').replace(/\/$/, '');
  const slugs = await listAllPublishedSlugs();
  const lastmod = new Date().toISOString().slice(0, 10);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${slugs
  .map(
    (slug) => `  <url>
    <loc>${base}/news/${escapeXml(slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
