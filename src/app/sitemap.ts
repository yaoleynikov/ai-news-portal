import { MetadataRoute } from 'next';
import { getSortedPosts, getAllTags } from '@/lib/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getSortedPosts();
  const tags = getAllTags();
  const base = 'https://siliconfeed.online';
  const staticRoutes = [
    { url: base, priority: 1.0 },
    { url: `${base}/news`, priority: 0.9 },
    { url: `${base}/about`, priority: 0.5 },
    { url: `${base}/contact`, priority: 0.3 },
    { url: `${base}/editorial-policy`, priority: 0.4 },
    { url: `${base}/privacy-policy`, priority: 0.2 },
  ];
  return [
    ...staticRoutes.map(r => ({
      url: r.url,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: r.priority,
    })),
    ...tags.map(tag => ({
      url: `${base}/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...posts.map(p => ({
      url: `${base}/news/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
