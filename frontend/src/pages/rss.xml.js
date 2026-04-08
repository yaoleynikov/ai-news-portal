import rss from '@astrojs/rss';
import { ARTICLES } from '../data/news';
import { articlePath } from '../lib/seo';

export async function GET(context) {
  return rss({
    title: 'SiliconFeed',
    description: 'Лента свежих IT и технологических новостей.',
    site: context.site,
    items: ARTICLES.map((a) => ({
      title: a.title,
      pubDate: new Date(a.created_at),
      description: a.excerpt || a.dek,
      link: articlePath(a.slug)
    })),
    customData: `<language>ru</language>`
  });
}
