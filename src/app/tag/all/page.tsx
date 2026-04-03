import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default async function AllPage() {
  const { getSortedPosts } = await import('@/lib/posts');
  const all = getSortedPosts();
  function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

  return (
    <div>
      <Header />
      <div className="wrap">
        <div className="sec"><span>All Stories</span><span>{all.length}</span></div>
        <div className="ll">
          {all.map(p => (
            <Link key={p.slug} href={`/news/${p.slug}`} className="row">
              <div className="row-b">
                <h4>{p.title}</h4>
                <p>{p.excerpt}</p>
                <div className="meta" style={{ marginTop: '6px' }}>
                  <span className="meta-t">{p.tags?.[0] || 'news'}</span>
                  <span className="meta-dot" />
                  <span className="meta-d">{fd(p.date)}</span>
                </div>
              </div>
              {p.coverImage && <div className="row-i"><img src={p.coverImage} alt="" loading="lazy" /></div>}
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
