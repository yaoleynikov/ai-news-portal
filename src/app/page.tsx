import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export default async function HomePage() {
  const all = getSortedPosts();
  const hero = all[0];
  const heroS = all.slice(1, 3);
  const grid3 = all.slice(3, 6);
  const grid2 = all.slice(6, 8);
  const list = all.slice(8);

  return (
    <div>
      <Header />
      <div className="shell">
        <div className="content">

          {/* HERO */}
          {hero && (
            <div className="hero">
              <a href={`/news/${hero.slug}`} className="hero-big">
                {hero.coverImage && <div className="hero-big-img"><img src={hero.coverImage} alt="" /></div>}
                <div className="hero-big-b">
                  <div className="meta"><span className="meta-t">{hero.tags?.[0] || 'tech'}</span><span className="meta-dot" /><span className="meta-d">{fd(hero.date)}</span></div>
                  <h2>{hero.title}</h2>
                </div>
              </a>
              <div className="hero-sm">
                {heroS.map(p => (
                  <a key={p.slug} href={`/news/${p.slug}`} className="hero-s">
                    <div className="meta"><span className="meta-t">{p.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(p.date)}</span></div>
                    <h3>{p.title}</h3>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 3-COL */}
          {grid3.length > 0 && (
            <>
              <div className="lbl"><span className="lbl-t">latest</span><span className="lbl-c">{grid3.length}</span></div>
              <div className="g3">
                {grid3.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="card">
                    {post.coverImage && <div className="card-img"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                    <div className="card-b">
                      <div className="meta"><span className="meta-t">{post.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(post.date)}</span></div>
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {/* 2-COL */}
          {grid2.length > 0 && (
            <div className="g2">
              {grid2.map(post => (
                <a key={post.slug} href={`/news/${post.slug}`} className="card">
                  <div className="card-b">
                    <div className="meta"><span className="meta-t">{post.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(post.date)}</span></div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* LIST */}
          {list.length > 0 && (
            <>
              <div className="lbl"><span className="lbl-t">more</span><span className="lbl-c">{list.length}</span></div>
              <div>
                {list.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="list-item">
                    <div className="li-b">
                      <h4>{post.title}</h4>
                      <p>{post.excerpt}</p>
                    </div>
                    {post.coverImage && <div className="li-i"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb">
            <p className="sb-l">topics</p>
            <div className="tag-grid">
              {['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (
                <a key={t} href={`/tag/${t}`} className="tag-btn">{t}</a>
              ))}
            </div>
          </div>
          <div className="sb">
            <p className="sb-l">status</p>
            <p style={{ fontSize: '12px', color: 'var(--text-s)', lineHeight: 1.6, margin: 0, fontFamily: 'var(--mono)' }}>
              sources: 130+<br/>
              updates: every 2h<br/>
              last: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          </div>
          <div className="sb">
            <p className="sb-l">recent</p>
            <div className="rel">
              {all.slice(0, 5).map(p => (
                <a key={p.slug} href={`/news/${p.slug}`}>{p.title.length > 50 ? p.title.substring(0, 47) + '…' : p.title}<span className="rel-d">{fd(p.date)}</span></a>
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
  return { title: 'siliconfeed — tech intelligence', description: 'Autonomous tech news aggregator.' };
}
