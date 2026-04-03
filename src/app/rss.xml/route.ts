import { getSortedPosts } from '@/lib/posts';

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function RSS() {
  const posts = getSortedPosts();
  const siteUrl = 'https://siliconfeed.online';
  const buildDate = new Date().toUTCString();

  let items = posts.map(post => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/news/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}/news/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>
  `).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SiliconFeed — Новости Кремниевой Долины</title>
    <link>${siteUrl}</link>
    <description>Автономный агрегатор IT-новостей: ИИ, стартапы, облако, кибербезопасность, приложения.</description>
    <language>ru</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
