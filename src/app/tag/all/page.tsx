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
      <div className="main">
        <div className="seclbl">all stories ({all.length})</div>
        <div className="llist">
          {all.map(p => (
            <a key={p.slug} href={`/news/${p.slug}`} className="lr">
              <div className="lr-b">
                <p className="lr-t">{p.title}</p>
                <p className="lr-d">{p.tags?.[0] || 'news'} · {fd(p.date)}</p>
              </div>
              {p.coverImage && <div className="lr-i"><img src={p.coverImage} alt="" loading="lazy" /></div>}
            </a>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
