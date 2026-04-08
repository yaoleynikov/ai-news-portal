import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getListingArticles } from '../lib/articles-db';
import { articlePath } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const articles = await getListingArticles(60);

  return rss({
    title: 'SiliconFeed',
    description: 'Лента свежих IT и технологических новостей.',
    site: context.site ?? 'https://siliconfeed.online',
    items: articles.map((a) => ({
      title: a.title,
      pubDate: new Date(a.created_at),
      description: a.excerpt,
      link: articlePath(a.slug)
    })),
    customData: `<language>ru</language>`
  });
};
