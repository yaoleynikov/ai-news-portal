import type { APIRoute } from 'astro';
import { getListingArticles } from '../lib/articles-db';
import { articlePath } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = async () => {
  const articles = await getListingArticles(200);
  const payload = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    tags: a.tags,
    created_at: a.created_at,
    path: articlePath(a.slug)
  }));

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=3600'
    }
  });
};
