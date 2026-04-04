import { getSortedPosts, getAllTags } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const POSTS_PER_PAGE = 15;

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

export const generateStaticParams = async () => {
  const slugs = getAllTags().map(t => t.toLowerCase());
  // Deduplicate with hardcoded list
  const base = ['all', 'ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'];
  return [...new Set([...base, ...slugs])].map(s => ({ slug: s }));
};

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawPage = parseInt(sp.p || '1', 10);
  const page = rawPage >= 1 ? rawPage : 1;

  const all = getSortedPosts();
  const isAll = slug === 'all';
  const filtered = isAll ? all : all.filter(p =>
    p.tags?.some(t => t.toLowerCase() === slug.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const pagePosts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  const tagLabel = isAll ? 'All Stories' : slug.charAt(0).toUpperCase() + slug.slice(1);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div>
      <Header />
      <div className="wrap">
        <div className="sec"><span>{tagLabel}</span><span>{filtered.length}</span></div>

        {filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-d)' }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '14px' }}>No stories yet</p>
          </div>
        ) : (
          <>
            <div className="llist">
              {pagePosts.map(p => (
                <Link key={p.slug} href={`/news/${p.slug}`} className="row">
                  {p.coverImage && <div className="ll-img"><img src={p.coverImage} alt="" loading="lazy" /></div>}
                  <div className="ll-b">
                    <h4>{p.title}</h4>
                    <p>{p.excerpt}</p>
                    <div className="meta" style={{ marginTop: '6px' }}>
                      <span className="meta-t">{p.tags?.[0] || 'news'}</span>
                      <span className="meta-dot" />
                      <span className="meta-d">{fd(p.date)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                {hasPrev && (
                  <Link href={`/tag/${slug}?p=${page - 1}`} className="page-btn">
                    ← Prev
                  </Link>
                )}
                <div className="page-dots">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
                    <Link
                      key={pn}
                      href={`/tag/${slug}?p=${pn}`}
                      className={pn === page ? 'page-btn page-active' : 'page-btn page-dot'}
                    >
                      {pn}
                    </Link>
                  ))}
                </div>
                {hasNext && (
                  <Link href={`/tag/${slug}?p=${page + 1}`} className="page-btn">
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

export const metadata = { title: 'siliconfeed — tag' };
