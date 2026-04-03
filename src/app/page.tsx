import Link from 'next/link';
import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtShortTime() {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).toUpperCase();
}

const TICKERS = [
  { slug: 'all', label: 'all' },
  { slug: 'ai', label: 'ai' },
  { slug: 'startups', label: 'startups' },
  { slug: 'cloud', label: 'cloud' },
  { slug: 'security', label: 'security' },
  { slug: 'crypto', label: 'crypto' },
  { slug: 'hardware', label: 'hardware' },
];

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const hero = allPosts[0];
  const sidePosts = allPosts.slice(1, 4);
  const grid = allPosts.slice(4, 8);
  const listItems = allPosts.slice(8);

  return (
    <div>
      <Header />
      <div className="main-layout">
        <div className="content-area">
          {hero && (
            <div className="bento-hero">
              <a href={`/news/${hero.slug}`} className="hero-main">
                {hero.coverImage ? (
                  <div className="hero-main-img"><img src={hero.coverImage} alt={hero.title} /></div>
                ) : <div className="hero-main-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}><span style={{ fontFamily: 'var(--mono)', fontSize: '48px', color: '#d4d4d4' }}>◆</span></div>}
                <div className="hero-main-body">
                  <div className="card-kicker">{hero.tags?.[0] || 'tech'}<span className="dot" />{fmtDate(hero.date)}</div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.3, margin: '0 0 6px 0' }}>{hero.title}</h2>
                  <p className="card-excerpt" style={{ color: 'var(--text-sec)' }}>{hero.excerpt}</p>
                </div>
              </a>
              <div className="hero-side">
                {sidePosts.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="hero-side-item">
                    <div className="card-kicker">{post.tags?.[0] || 'news'}<span className="dot" />{fmtDate(post.date)}</div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.35, margin: 0 }}>{post.title}</h3>
                  </a>
                ))}
              </div>
            </div>
          )}

          {grid.length > 0 && (
            <>
              <div className="section-label"><span>latest</span><span className="count">{grid.length} stories</span></div>
              <div className="grid-feed">
                {grid.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="card">
                    {post.coverImage ? (<div className="card-img"><img src={post.coverImage} alt="" loading="lazy" /></div>) : (<div className="card-img" style={{ backgroundColor: '#f5f5f5' }} />)}
                    <div className="card-body">
                      <div className="card-kicker">{post.tags?.[0] || 'news'}<span className="dot" />{fmtDate(post.date)}</div>
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {listItems.length > 0 && (
            <>
              <div className="section-label"><span>more</span></div>
              <div className="list-feed">
                {listItems.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="list-item">
                    <div className="list-main">
                      <div className="list-kicker">{post.tags?.[0] || 'news'}<span style={{ margin: '0 5px', color: 'var(--text-tertiary)' }}>·</span>{fmtDate(post.date)}</div>
                      <h4>{post.title}</h4>
                      <p>{post.excerpt}</p>
                    </div>
                    {post.coverImage && <div className="list-thumb"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="sidebar-label">topics</p>
            <div className="tag-grid">
              {['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (
                <a key={t} href={`/tag/${t}`} className="tag-chip">{t}</a>
              ))}
            </div>
          </div>
          <div className="sidebar-section">
            <p className="sidebar-label">about</p>
            <p style={{ fontSize: '13px', color: 'var(--text-sec)', lineHeight: 1.6, margin: 0 }}>autonomous tech news aggregator. 130+ sources, published in real-time.</p>
            <a href="/about" style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text)', marginTop: '10px', display: 'inline-block' }}>read more →</a>
          </div>
          <div className="sidebar-section">
            <p className="sidebar-label">recent</p>
            <div className="as-related">
              {allPosts.slice(0, 5).map(post => (
                <a key={post.slug} href={`/news/${post.slug}`}>{post.title.length > 55 ? post.title.substring(0, 52) + '…' : post.title}<span className="related-date">{fmtDate(post.date)}</span></a>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );
}

export function generateMetadata() {
  return { title: 'siliconfeed — autonomous tech news', description: 'Autonomous aggregator of tech intelligence.' };
}
