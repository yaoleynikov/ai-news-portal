import { MetadataRoute } from 'next';
import { getSortedPosts } from '@/lib/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getSortedPosts();
  const base = 'https://ai-insight-2026.vercel.app';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    ...posts.map(p => ({
      url: `${base}/news/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
