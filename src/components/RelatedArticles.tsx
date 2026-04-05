'use client';

import Link from 'next/link';

interface Post {
  slug: string;
  title: string;
  date: string;
  tag: string;
}

interface RelatedProps {
  posts: Post[];
}

export default function RelatedArticles({ posts }: RelatedProps) {
  if (posts.length === 0) return null;

  return (
    <section className="related" style={{ maxWidth: 1200, margin: '0 auto 60px', padding: '0 20px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#e4e4e7' }}>
        Related Articles
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {posts.map(post => (
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
