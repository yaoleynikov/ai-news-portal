import { getPostBySlug, getAllPostSlugs, getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return getAllPostSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
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

  // Parse frontmatter for YouTube ID
  const ytMatch = post.rawContent?.match(/youtubeId:\s*"?([^"\n]+)"?/);
  const youtubeId = ytMatch ? ytMatch[1].trim() : null;

  // Extract Monster Take from content if present
  const contentHtml = post.contentHtml;

  return (
    <div>
      <Header />
      <div className="ashell">
        <article>
          <div className="abar">
            <span>{post.tags?.[0] || 'news'}</span>
            <span style={{ color: 'var(--text-t)' }}>·</span>
            <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            <span style={{ color: 'var(--text-t)' }}>·</span>
            <span>{mins} min</span>
          </div>

          {post.coverImage && (
            <figure className="aimg">
              <img src={post.coverImage} alt={post.title} />
            </figure>
          )}

          {youtubeId && (
            <div style={{ maxWidth: '620px', margin: '0 auto', padding: '24px 4px 0' }}>
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          <div className="a-body">
            <h1>{post.title}</h1>
            <p className="a-sub">{post.excerpt}</p>
            <div className="rich" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            <div className="mt">
              <p className="mt-l">monster take</p>
              {/* Monster Take is extracted from content by the article content */}
            </div>
          </div>
        </article>

        <aside className="a-side">
          <div style={{ position: 'sticky', top: '49px' }}>
            <div className="sbox">
              <p className="slbl">more</p>
              <div className="rel">
                {related.map(p => (
                  <a key={p.slug} href={`/news/${p.slug}`}>
                    {p.title.length > 55 ? p.title.substring(0, 52) + '…' : p.title}
                    <span className="rel-d">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="sbox">
              <p className="slbl">share</p>
              <div style={{ display: 'flex', gap: '4px' }}>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}`} target="_blank" rel="noopener" className="ttag" style={{ fontSize: '11px' }}>twitter</a>
                <a href={`https://news.ycombinator.com/submitlink?u=${encodeURIComponent(`https://siliconfeed.online/news/${post.slug}`)}&t=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener" className="ttag" style={{ fontSize: '11px' }}>hn</a>
              </div>
            </div>
            <div className="sbox">
              <p className="slbl">topics</p>
              <div className="tbox">
                {['ai', 'startups', 'cloud', 'security'].map(t => (
                  <a key={t} href={`/tag/${t}`} className="ttag">{t}</a>
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
