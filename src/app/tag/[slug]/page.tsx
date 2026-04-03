import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export const generateStaticParams = async () => {
  return ['all', 'ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(slug => ({ slug }));
};

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = getSortedPosts();
  const isAll = slug === 'all';
  const filtered = isAll ? all : all.filter(p =>
    p.tags?.some(t => t.toLowerCase() === slug.toLowerCase())
  );
  const tagLabel = isAll ? 'All Stories' : slug.charAt(0).toUpperCase() + slug.slice(1);

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
          <div className="llist">
            {filtered.map(p => (
              <Link key={p.slug} href={`/news/${p.slug}`} className="row">
                {p.coverImage && <div className="ll-img"><img src={p.coverImage} alt="" loading="lazy" /></div>}
                <div className="ll-b">
                  <h4>{p.title}</h4>
                  <p>{p.excerpt}</p>
                  <div className="meta" style={{ marginTop: '6px' }}>
                    <span className="meta-t">{p.tags?.[0] || 'news'}</span>
                    <span className="meta-dot" />
                    <span className="meta-d">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export const metadata = { title: 'siliconfeed — tag' };
