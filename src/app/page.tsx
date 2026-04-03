import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export default async function HomePage() {
  const all = getSortedPosts();
  const hero = all[0];
  const hero2 = all.slice(1, 3);
  const grid3 = all.slice(3, 6);
  const grid2 = all.slice(6, 8);
  const list = all.slice(8);

  return (
    <div>
      <Header />
      <div className="main">

        {/* HERO */}
        {hero && (
          <div className="mhero">
            <a href={`/news/${hero.slug}`} className="mhero-main">
              {hero.coverImage && <div className="mhero-img"><img src={hero.coverImage} alt="" /></div>}
              <div className="mhero-tag">{hero.tags?.[0] || 'tech'}</div>
              <h2>{hero.title}</h2>
              <p>{hero.excerpt}</p>
            </a>
            <div className="mhero-side">
              {hero2.map(p => (
                <a key={p.slug} href={`/news/${p.slug}`} className="mside">
                  <div className="mside-tag">{p.tags?.[0] || 'news'} · {fd(p.date)}</div>
                  <h3>{p.title}</h3>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 3-COL */}
        {grid3.length > 0 && (
          <>
            <div className="seclbl">latest</div>
            <div className="grid3">
              {grid3.map(post => (
                <a key={post.slug} href={`/news/${post.slug}`} className="g3">
                  {post.coverImage && <div className="g3-img"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                  <div className="g3-tag">{post.tags?.[0] || 'news'}</div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                </a>
              ))}
            </div>
          </>
        )}

        {/* 2-COL */}
        {grid2.length > 0 && (
          <div className="grid2">
            {grid2.map(post => (
              <a key={post.slug} href={`/news/${post.slug}`} className="g2">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
              </a>
            ))}
          </div>
        )}

        {/* LIST */}
        {list.length > 0 && (
          <>
            <div className="seclbl">{list.length} more stories</div>
            <div className="llist">
              {list.map(post => (
                <a key={post.slug} href={`/news/${post.slug}`} className="lr">
                  <div className="lr-b">
                    <p className="lr-t">{post.title}</p>
                    <p className="lr-d">{post.tags?.[0] || 'news'} · {fd(post.date)}</p>
                  </div>
                  {post.coverImage && <div className="lr-i"><img src={post.coverImage} alt="" loading="lazy" /></div>}
                </a>
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
