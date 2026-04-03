import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export const metadata = { title: 'all // siliconfeed' };

export default async function AllPage() {
  const all = getSortedPosts();
  return (
    <div>
      <Header />
      <div className="shell">
        <div className="col">
          <div className="lbl"><span>all stories</span><span>{all.length}</span></div>
          <div className="lst">
            {all.map(p => (
              <a key={p.slug} href={`/news/${p.slug}`} className="r">
                <div className="r-b">
                  <div className="meta"><span className="meta-t">{p.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(p.date)}</span></div>
                  <h4>{p.title}</h4>
                  <p>{p.excerpt}</p>
                </div>
                {p.coverImage && <div className="r-i"><img src={p.coverImage} alt="" loading="lazy" /></div>}
              </a>
            ))}
          </div>
        </div>
        <aside className="side">
          <div className="sb"><p className="sl">topics</p><div className="tb">{['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (<a key={t} href={`/tag/${t}`}>{t}</a>))}</div></div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
