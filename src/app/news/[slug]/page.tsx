import { getPostBySlug, getAllPostSlugs, getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';

export async function generateStaticParams() { return getAllPostSlugs().map(slug => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const post = getPostBySlug(slug);
  if (!post) return { title: 'not found' };
  return { title: post.title, description: post.excerpt };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const words = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const mins = Math.ceil(words / 200);
  const related = getSortedPosts().filter(p => p.slug !== slug).slice(0, 4);

  // Parse Monster Take from raw markdown
  let mtText = '';
  if (post.rawContent) {
    const fmEnd = post.rawContent.indexOf('---', 3);
    if (fmEnd > -1) {
      const body = post.rawContent.substring(fmEnd + 3);
      const mtM = body.match(/## Monster Take\s*([\s\S]+)/);
      if (mtM) mtText = mtM[1].replace(/^[\n\r]+/, '').replace(/^> /gm, '').trim();
    }
  }

  // Remove from rendered HTML
  const cleanHtml = post.contentHtml.replace(/<h2[^>]*>\s*Monster Take\s*<\/h2>[\s\S]*$/, '');

  return (
    <div>
      <Header />
      <div className="ashell">
        <article>
          <div className="a-bar">
            <span>{post.tags?.[0] || 'news'}</span>
            <span style={{ color: 'var(--text-d)' }}>·</span>
            <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            <span style={{ color: 'var(--text-d)' }}>·</span>
            <span>{mins} min read</span>
          </div>

          {post.coverImage && (
            <figure className="a-img">
              <img src={post.coverImage} alt="" />
            </figure>
          )}

          <div className="a-wrap">
            <h1>{post.title}</h1>
            <p className="a-sub">{post.excerpt}</p>
            <div className="rich" dangerouslySetInnerHTML={{ __html: cleanHtml }} />

            <div className="mt">
              <p className="mt-l">monster take</p>
              <p>{mtText || 'No analysis yet.'}</p>
            </div>
          </div>
        </article>

        <aside className="a-side-wrap">
          <div style={{ position: 'sticky', top: '47px' }}>
            <div className="sb">
              <p className="sb-l">share</p>
              <div style={{ display: 'flex', gap: '4px' }}>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}`} target="_blank" rel="noopener" className="tag-btn" style={{ fontSize: '10px', padding: '5px 6px' }}>twitter</a>
                <a href={`https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}&t=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener" className="tag-btn" style={{ fontSize: '10px', padding: '5px 6px' }}>hacker news</a>
              </div>
            </div>
            <div className="sb">
              <p className="sb-l">more</p>
              <div className="rel">
                {related.map(p => (
                  <a key={p.slug} href={`/news/${p.slug}`}>
                    {p.title.length > 50 ? p.title.substring(0, 47) + '…' : p.title}
                    <span className="rel-d">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="sb">
              <p className="sb-l">topics</p>
              <div className="tag-grid">
                {['ai', 'startups', 'cloud', 'security'].map(t => (
                  <a key={t} href={`/tag/${t}`} className="tag-btn">{t}</a>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
