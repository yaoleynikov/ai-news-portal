import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

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
      <div className="wrap">

        {/* HERO */}
        {hero && (
          <div className="hero">
            <Link href={`/news/${hero.slug}`} className="hero-big">
              {hero.coverImage && <div className="hero-img"><img src={hero.coverImage} alt="" /></div>}
              <div className="meta">
                <span className="meta-t">{hero.tags?.[0] || 'tech'}</span>
                <span className="meta-dot" />
                <span className="meta-d">{fd(hero.date)}</span>
              </div>
              <h2>{hero.title}</h2>
              <p>{hero.excerpt}</p>
            </Link>
            <div className="hero-right">
              {heroS.map(p => (
                <Link key={p.slug} href={`/news/${p.slug}`} className="hero-side">
                  <div className="meta">
                    <span className="meta-t">{p.tags?.[0] || 'news'}</span>
                    <span className="meta-dot" />
                    <span className="meta-d">{fd(p.date)}</span>
                  </div>
                  <h3>{p.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 3 COL GRID */}
        {grid3.length > 0 && (
          <>
            <div className="sec"><span>Latest</span><span>{grid3.length} stories</span></div>
            <div className="g3">
              {grid3.map(post => (
                <Link key={post.slug} href={`/news/${post.slug}`} className="c">
                  {post.coverImage && <div className="c-img"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                  <div className="c-b">
                    <div className="meta">
                      <span className="meta-t">{post.tags?.[0] || 'news'}</span>
                      <span className="meta-dot" />
                      <span className="meta-d">{fd(post.date)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* 2 COL GRID */}
        {grid2.length > 0 && (
          <>
            <div className="sec"><span>Featured</span></div>
            <div className="g2">
              {grid2.map(post => (
                <Link key={post.slug} href={`/news/${post.slug}`} className="c">
                  <div className="c-b">
                    <div className="meta">
                      <span className="meta-t">{post.tags?.[0] || 'news'}</span>
                      <span className="meta-dot" />
                      <span className="meta-d">{fd(post.date)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* LIST */}
        {list.length > 0 && (
          <>
            <div className="sec"><span>More</span><span>{list.length}</span></div>
            <div className="ll">
              {list.map(post => (
                <Link key={post.slug} href={`/news/${post.slug}`} className="row">
                  <div className="row-b">
                    <h4>{post.title}</h4>
                    <p>{post.excerpt}</p>
                    <div className="meta" style={{ marginTop: '4px' }}>
                      <span className="meta-t">{post.tags?.[0] || 'news'}</span>
                      <span className="meta-dot" />
                      <span className="meta-d">{fd(post.date)}</span>
                    </div>
                  </div>
                  {post.coverImage && <div className="row-i"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

export function generateMetadata() {
  return { title: 'siliconfeed — tech intelligence', description: 'Autonomous tech news aggregator.' };
}
