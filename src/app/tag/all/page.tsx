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
        <div className="content">
          <div className="lbl"><span className="lbl-t">all stories</span><span className="lbl-c">{all.length}</span></div>
          <div>
            {all.map(p => (
              <a key={p.slug} href={`/news/${p.slug}`} className="list-item">
                <div className="li-b">
                  <h4>{p.title}</h4>
                  <p>{p.excerpt}</p>
                </div>
                {p.coverImage && <div className="li-i"><img src={p.coverImage} alt="" loading="lazy" /></div>}
              </a>
            ))}
          </div>
        </div>
        <aside className="sidebar">
          <div className="sb"><p className="sb-l">topics</p><div className="tag-grid">{['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (<a key={t} href={`/tag/${t}`} className="tag-btn">{t}</a>))}</div></div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
