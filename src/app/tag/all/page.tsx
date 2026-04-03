import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const metadata = { title: 'all stories // siliconfeed' };

export default async function AllPostsPage() {
  const allPosts = getSortedPosts();
  return (
    <div>
      <Header />
      <div className="main-layout">
        <div className="content-area">
          <div className="section-label">
            <span>all stories</span>
            <span className="count">{allPosts.length}</span>
          </div>
          <div className="list-feed">
            {allPosts.map(post => (
              <a key={post.slug} href={`/news/${post.slug}`} className="list-item">
                <div className="list-main">
                  <div className="list-kicker">{post.tags?.[0] || 'news'} <span style={{ margin: '0 5px', color: 'var(--text-tertiary)' }}>·</span> {fmtDate(post.date)}</div>
                  <h4>{post.title}</h4>
                  <p>{post.excerpt}</p>
                </div>
                {post.coverImage && <div className="list-thumb"><img src={post.coverImage} alt="" loading="lazy" /></div>}
              </a>
            ))}
          </div>
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
        </aside>
      </div>
      <Footer />
    </div>
  );
}
