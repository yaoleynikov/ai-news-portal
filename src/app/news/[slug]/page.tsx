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

  // Parse Monster Take from raw markdown body
  let mtText = '';
  if (post.rawContent) {
    const fmEnd = post.rawContent.indexOf('---', 3);
    if (fmEnd > -1) {
      const body = post.rawContent.substring(fmEnd + 3);
      const mtM = body.match(/## Monster Take\s*([\s\S]+)/);
      if (mtM) mtText = mtM[1].replace(/^[\n\r]+/, '').replace(/^> /gm, '').trim();
    }
  }

  // Remove Monster Take from rendered HTML
  const cleanHtml = post.contentHtml.replace(/<h2[^>]*>\s*Monster Take\s*<\/h2>[\s\S]*$/, '');

  return (
    <div>
      <Header />
      <div className="a-wrap">
        <div className="a-top">
          <div className="a-bar">
            <span>{post.tags?.[0] || 'news'}</span>
            <span style={{ color: 'var(--text-d)' }}>·</span>
            <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            <span style={{ color: 'var(--text-d)' }}>·</span>
            <span>{mins} min read</span>
          </div>
        </div>

        {post.coverImage && (
          <figure className="a-img">
            <img src={post.coverImage} alt="" />
          </figure>
        )}

        <div className="a-body">
          <h1>{post.title}</h1>
          <p className="a-sub">{post.excerpt}</p>
          <div className="rich" dangerouslySetInnerHTML={{ __html: cleanHtml }} />

          <div className="mt">
            <p className="mt-l">monster take</p>
            <p>{mtText || 'No analysis yet.'}</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
