'use client';

import { getSortedPosts } from '@/lib/posts';
import Link from 'next/link';

interface RelatedProps {
  currentSlug: string;
  tags: string[];
  date: string;
  limit?: number;
}

function scorePost(post: any, tags: string[], currentSlug: string, currentDate: string): number {
  if (post.slug === currentSlug) return -1;
  let score = 0;
  const postTags = (post.tags || []).map((t: string) => t.toLowerCase());
  const searchTags = tags.map(t => t.toLowerCase());
  for (const t of searchTags) {
    if (postTags.includes(t)) score += 10;
  }
  // Recency bonus
  const postDate = new Date(post.date).getTime();
  const currentDate = new Date(currentDate).getTime();
  const diffDays = Math.abs(postDate - currentDate) / (1000 * 60 * 60 * 24);
  if (diffDays < 3) score += 5;
  else if (diffDays < 7) score += 3;
  else if (diffDays < 30) score += 1;
  return score;
}

export default function RelatedArticles({ currentSlug, tags, date, limit = 4 }: RelatedProps) {
  const allPosts = getSortedPosts();
  const related = allPosts
    .map(post => ({
      ...post,
      score: scorePost(post, tags, currentSlug, date),
    }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (related.length === 0) return null;

  return (
    <section className="related" style={{ maxWidth: 1200, margin: '0 auto 60px', padding: '0 20px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#e4e4e7' }}>
        Related Articles
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {related.map(post => (
          <Link key={post.slug} href={`/news/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                background: '#18181b',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #27272a',
                transition: 'transform 0.2s, border-color 0.2s',
                height: '100%',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.borderColor = '#8b5cf6';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a';
              }}
            >
              <img
                src={`/covers/${post.slug}.jpg?v=v5`}
                alt={post.title}
                style={{ width: '100%', height: 160, objectFit: 'cover' }}
                loading="lazy"
              />
              <div style={{ padding: '12px 16px 16px' }}>
                <div style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                  {post.tag}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginBottom: 8, color: '#e4e4e7' }}>
                  {post.title}
                </h3>
                <time style={{ fontSize: 12, color: '#71717a' }}>
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </time>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
