import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function fd(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export default async function AllPostsPage() {
  const all = getSortedPosts();
  return (
    <div>
      <Header />
      <div className="shell">
        <div className="col">
          <div className="lbl"><span>all stories</span><span>{all.length}</span></div>
          <div className="lst">
            {all.map(post => (
              <a key={post.slug} href={`/news/${post.slug}`} className="row">
                <div className="row-b">
                  <div className="meta"><span className="meta-t">{post.tags?.[0] || 'news'}</span><span className="meta-dot" /><span className="meta-d">{fd(post.date)}</span></div>
                  <h4>{post.title}</h4>
                  <p>{post.excerpt}</p>
                </div>
                {post.coverImage && <div className="row-img"><img src={post.coverImage} alt="" loading="lazy" /></div>}
              </a>
            ))}
          </div>
        </div>
        <aside className="side">
          <div className="sbox">
            <p className="slbl">topics</p>
            <div className="tbox">
              {['ai', 'startups', 'cloud', 'security', 'crypto', 'hardware'].map(t => (
                <a key={t} href={`/tag/${t}`} className="ttag">{t}</a>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
