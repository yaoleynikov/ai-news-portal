import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export default async function HomePage() {
  const all = getSortedPosts();
  const hero = all[0];
  const side = all.slice(1, 4);
  const grid = all.slice(4, 8);
  const list = all.slice(8);

  return (
    <div>
      <Header />
      <div className="shell">
        <div className="col">
          {hero && (
            <div className="hero">
              <a href={`/news/${hero.slug}`} className="hero-big">
                {hero.coverImage ? (
                  <div className="hero-big-img"><img src={hero.coverImage} alt="" /></div>
                ) : <div className="hero-big-img" />}
                <div className="hero-big-body">
                  <div className="meta"><span className="meta-t">{hero.tags?.[0] || 'tech'}</span><span className="meta-dot" /><span className="meta-d">{fd(hero.date)}</span></div>
                  <h2>{hero.title}</h2>
                </div>
              </a>
              <div className="hero-sm">
                {side.map(p => (
                  <a key={p.slug} href={`/news/${p.slug}`} className="hero-sm">
                    <div className="meta"><span className="meta-t">{p.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(p.date)}</span></div>
                    <h3>{p.title}</h3>
                  </a>
                ))}
              </div>
            </div>
          )}

          {grid.length > 0 && (
            <>
              <div className="lbl"><span>latest</span><span>{grid.length}</span></div>
              <div className="g2">
                {grid.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="c">
                    {post.coverImage ? <div className="c-img"><img src={post.coverImage} alt="" loading="lazy" /></div> : <div className="c-img" />}
                    <div className="c-b">
                      <div className="meta"><span className="meta-t">{post.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(post.date)}</span></div>
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {list.length > 0 && (
            <>
              <div className="lbl"><span>more</span></div>
              <div className="lst">
                {list.map(post => (
                  <a key={post.slug} href={`/news/${post.slug}`} className="r">
                    <div className="r-b">
                      <div className="meta"><span className="meta-t">{post.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(post.date)}</span></div>
                      <h4>{post.title}</h4>
                      <p>{post.excerpt}</p>
                    </div>
                    {post.coverImage && <div className="r-i"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="side">
          <div className="sb">
            <p className="sl">topics</p>
            <div className="tb">
              {['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (
                <a key={t} href={`/tag/${t}`}>{t}</a>
              ))}
            </div>
          </div>
          <div className="sb">
            <p className="sl">about</p>
            <p style={{ fontSize: '13px', color: 'var(--text-m)', lineHeight: 1.5, margin: 0 }}>autonomous tech news. 130+ sources. real-time.</p>
            <a href="/about" style={{ fontSize: '11px', fontFamily: 'var(--mono)', display: 'inline-block', marginTop: '6px' }}>more →</a>
          </div>
          <div className="sb">
            <p className="sl">recent</p>
            <div className="rl">
              {all.slice(0, 5).map(p => (
                <a key={p.slug} href={`/news/${p.slug}`}>{p.title.length > 50 ? p.title.substring(0, 47) + '…' : p.title}<span className="rl-d">{fd(p.date)}</span></a>
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
