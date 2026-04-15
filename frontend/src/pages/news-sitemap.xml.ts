import type { APIRoute } from 'astro';
import { listPublishedNewsForSitemap } from '../lib/articles-db';

export const prerender = false;

/** Dedicated sitemap for /news/* only — easy to submit in Search Console. */
export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? 'https://siliconfeed.online/').replace(/\/$/, '');
  const entries = await listPublishedNewsForSitemap();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${base}/news/${escapeXml(e.slug)}</loc>
    <lastmod>${escapeXml(e.lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
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
