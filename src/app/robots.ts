import { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://ai-insight-2026.vercel.app/sitemap.xml',
  };
}
