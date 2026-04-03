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
  return {
    title: post.title, description: post.excerpt,
    openGraph: {
      title: post.title, description: post.excerpt, type: 'article', publishedTime: post.date,
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const words = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const mins = Math.ceil(words / 200);
  const related = getSortedPosts().filter(p => p.slug !== slug).slice(0, 4);

  // Parse Monster Take from rendered HTML
  const mtMatch = post.contentHtml.match(/<h2[^>]*>\s*Monster Take\s*<\/h2>([\s\S]*)/i);
  const mtText = mtMatch ? mtMatch[1].replace(/<[^>]*>/g, '').replace(/^\s+/, '').trim() : '';

  // Remove Monster Take from clean HTML
  let cleanHtml = post.contentHtml.replace(/<h2[^>]*>\s*Monster Take\s*<\/h2>[\s\S]*$/, '');

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
              <img src={post.coverImage} alt="" />
            </figure>
          )}

          <div className="a-body">
            <h1>{post.title}</h1>
            <p className="a-sub">{post.excerpt}</p>
            <div className="rich" dangerouslySetInnerHTML={{ __html: cleanHtml }} />

            <div className="mt">
              <p className="mt-l">monster take</p>
              <p>{mtText || 'Coming soon.'}</p>
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
                    {p.title.length > 50 ? p.title.substring(0, 47) + '…' : p.title}
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
