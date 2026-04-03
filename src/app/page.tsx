import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShort(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const featured = allPosts[0];
  const grid = allPosts.slice(1, 5);
  const latest = allPosts.slice(5);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">

        {/* FEATURED — full-width hero */}
        {featured && (
          <a href={`/news/${featured.slug}`} className="featured">
            {featured.coverImage && (
              <div className="featured-image">
                <img src={featured.coverImage} alt={featured.title} />
              </div>
            )}
            <div>
              <div className="featured-meta">
                <span className="featured-tag">{featured.tags?.[0] || 'Tech'}</span>
                <span className="featured-date">{fmtDate(featured.date)}</span>
              </div>
              <h2>{featured.title}</h2>
              <p className="featured-excerpt">{featured.excerpt}</p>
            </div>
          </a>
        )}

        {/* TWO COLUMN — grid + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 mb-12">
          {/* Articles Grid */}
          <div>
            <div className="section-label">
              <h2>Top Stories</h2>
              <span className="section-line" />
            </div>
            <div className="articles-grid">
              {grid.map(post => (
                <a key={post.slug} href={`/news/${post.slug}`} className="card">
                  {post.coverImage ? (
                    <div className="card-image">
                      <img src={post.coverImage} alt={post.title} loading="lazy" />
                    </div>
                  ) : (
                    <div className="card-image" style={{ background: 'linear-gradient(135deg,#fed7aa,#fbbf24)' }} />
                  )}
                  <div className="card-body">
                    <div className="card-meta">
                      <span className="card-tag">{post.tags?.[0] || 'News'}</span>
                      <span className="card-date">{fmtShort(post.date)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p className="card-excerpt">{post.excerpt}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sidebar-sticky">
              <div className="sidebar-box">
                <h4 className="sidebar-title">About SiliconFeed</h4>
                <p className="sidebar-text">
                  Autonomous tech news aggregator. 130+ sources, published in real-time. No humans required.
                </p>
                <a href="/about" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                  Learn more →
                </a>
              </div>
              <div className="sidebar-box">
                <h4 className="sidebar-title">Topics</h4>
                <div className="topic-cloud">
                  {['AI', 'Startups', 'Cloud', 'Security', 'Crypto', 'Google', 'OpenAI', 'Hardware'].map(t => (
                    <a key={t} href={`/tag/${t.toLowerCase()}`} className="topic-chip">{t}</a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* LATEST — list layout */}
        {latest.length > 0 && (
          <div className="mb-12">
            <div className="section-label">
              <h2>Latest</h2>
              <span className="section-line" />
            </div>
            <div className="latest-list">
              {latest.map(post => (
                <a key={post.slug} href={`/news/${post.slug}`} className="latest-item">
                  <div className="latest-info">
                    <div className="latest-meta">
                      <span className="latest-tag">{post.tags?.[0] || 'News'}</span>
                      <span className="latest-date">{fmtShort(post.date)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                  </div>
                  {post.coverImage && (
                    <div className="latest-thumb">
                      <img src={post.coverImage} alt="" loading="lazy" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: 'SiliconFeed — Silicon Valley & Tech News',
    description: 'Autonomous aggregator of tech news: AI, startups, cloud, cybersecurity, crypto.',
  };
}
