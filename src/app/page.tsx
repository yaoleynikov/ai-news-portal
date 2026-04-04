import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Metadata } from 'next';

const POSTS_PER_PAGE = 10;

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

// Article row for pagination list
function ArticleRow({ post }: { post: { slug: string; title: string; excerpt: string; coverImage: string; coverAlt: string; tags?: string[]; date: string } }) {
  return (
    <Link href={`/news/${post.slug}`} className="row">
      <div className="ll-img"><img src={post.coverImage} alt={post.coverAlt || ''} loading="lazy" /></div>
      <div className="ll-b">
        <h4>{post.title}</h4>
        <p>{post.excerpt}</p>
        <div className="meta">
          {post.tags?.map((t, i) => (
            <span key={t}>
              {i > 0 && <span className="meta-dot"> </span>}
              <span className="meta-t">{t}</span>
            </span>
          )) || <span className="meta-t">{post.tags?.[0] || 'news'}</span>}
          <span className="meta-dot"> · </span>
          <span className="meta-d">{fd(post.date)}</span>
        </div>
      </div>
    </Link>
  );
}

export const metadata: Metadata = {
  title: 'siliconfeed — tech intelligence',
  description: 'Autonomous tech news aggregator.',
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q || '';
  const rawPage = parseInt(sp.p || '1', 10);
  const page = rawPage >= 1 ? rawPage : 1;

  let all = getSortedPosts();

  // Search filter
  if (query) {
    const q = query.toLowerCase();
    all = all.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  const hero = page === 1 && !query ? all[0] : null;
  const heroS = page === 1 && !query ? all.slice(1, 3) : [];

  // For paginated archive, exclude hero+heroS
  const archiveStart = hero ? 3 : 0;
  const archivePosts = all.slice(archiveStart);
  const totalPages = Math.ceil(archivePosts.length / POSTS_PER_PAGE);
  const pagePosts = archivePosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div>
      <Header />
      <div className="wrap">

        {/* Search indicator */}
        {query && (
          <div className="sec">
            <span>Search results for "{query}"</span>
            <span>{all.length}</span>
          </div>
        )}

        {/* HERO — only on page 1, no search */}
        {hero && (
          <div className="hero">
            <Link href={`/news/${hero.slug}`} className="hero-big">
              <div className="hero-img"><img src={hero.coverImage} alt={hero.coverAlt || ''} loading="eager" /></div>
              <div className="meta"><span className="meta-t">{hero.tags?.[0] || 'tech'}</span><span className="meta-dot" /><span className="meta-d">{fd(hero.date)}</span></div>
              <h2>{hero.title}</h2>
              <p>{hero.excerpt}</p>
            </Link>
            <div className="hero-right">
              {heroS.map(p => (
                <Link key={p.slug} href={`/news/${p.slug}`} className="hero-s">
                  <div className="meta"><span className="meta-t">{p.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(p.date)}</span></div>
                  <h3>{p.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}
        {/* Search result hero (show top result as hero even on search) */}
        {query && all.length > 0 && (
          <div className="hero">
            <Link href={`/news/${all[0].slug}`} className="hero-big">
              <div className="hero-img"><img src={all[0].coverImage} alt={all[0].coverAlt || ''} loading="eager" /></div>
              <div className="meta"><span className="meta-t">{all[0].tags?.[0] || 'tech'}</span><span className="meta-dot" /><span className="meta-d">{fd(all[0].date)}</span></div>
              <h2>{all[0].title}</h2>
              <p>{all[0].excerpt}</p>
            </Link>
            <div className="hero-right">
              {all.slice(1, 4).map(p => (
                <Link key={p.slug} href={`/news/${p.slug}`} className="hero-s">
                  <div className="meta"><span className="meta-t">{p.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(p.date)}</span></div>
                  <h3>{p.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* PAGINATED ARCHIVE */}
        {pagePosts.length > 0 && (
          <>
            <div className="sec">
              <span>{query ? 'More results' : page === 1 ? 'Archive' : `Page ${page}`} </span>
              <span>{archivePosts.length}</span>
            </div>
            <div className="llist">
              {pagePosts.map(post => (
                <ArticleRow key={post.slug} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                {hasPrev && (
                  <Link
                    href={query ? `/?q=${encodeURIComponent(query)}&p=${page - 1}` : `/?p=${page - 1}`}
                    className="page-btn"
                  >
                    ← Newer
                  </Link>
                )}
                <div className="page-dots">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={query ? `/?q=${encodeURIComponent(query)}&p=${p}` : `/?p=${p}`}
                      className={p === page ? 'page-btn page-active' : 'page-btn page-dot'}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
                {hasNext && (
                  <Link
                    href={query ? `/?q=${encodeURIComponent(query)}&p=${page + 1}` : `/?p=${page + 1}`}
                    className="page-btn"
                  >
                    Older →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {all.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-d)' }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '14px' }}>No stories found</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
