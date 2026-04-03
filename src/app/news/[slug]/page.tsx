import { getPostBySlug, getAllPostSlugs, getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return getAllPostSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'not found' };
  return { title: post.title, description: post.excerpt };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const wordCount = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const readTime = Math.ceil(wordCount / 200);
  const otherPosts = getSortedPosts().filter(p => p.slug !== slug).slice(0, 4);

  return (
    <div>
      <Header />
      <div className="article-layout">
        <article className="article-main">
          <div className="article-meta-bar">
            <span>{post.tags?.[0] || 'news'}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span>{readTime} min read</span>
          </div>

          {post.coverImage && (
            <figure className="article-hero">
              <img src={post.coverImage} alt={post.title} />
            </figure>
          )}

          <div className="article-content">
            <h1>{post.title}</h1>
            <p className="article-excerpt-text">{post.excerpt}</p>
            <div className="article-body" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
          </div>
        </article>

        <aside className="article-sidebar">
          <div className="as-sticky">
            <div className="as-section">
              <p className="as-label">more stories</p>
              <div className="as-related">
                {otherPosts.map(p => (
                  <a key={p.slug} href={`/news/${p.slug}`}>
                    {p.title.length > 55 ? p.title.substring(0, 52) + '…' : p.title}
                    <span className="related-date">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="as-section">
              <p className="as-label">share</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}`}
                  target="_blank" rel="noopener" className="tag-chip" style={{ fontSize: '11px' }}
                >
                  twitter
                </a>
                <a
                  href={`https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}&t=${encodeURIComponent(post.title)}`}
                  target="_blank" rel="noopener" className="tag-chip" style={{ fontSize: '11px' }}
                >
                  hacker news
                </a>
              </div>
            </div>

            <div className="as-section">
              <p className="as-label">topics</p>
              <div className="tag-grid">
                {['ai', 'startups', 'cloud', 'security'].map(t => (
                  <a key={t} href={`/tag/${t}`} className="tag-chip">{t}</a>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
