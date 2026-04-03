import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return getAllPostSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Not Found' };
  return {
    title: post.title,
    description: post.excerpt,
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

  const wordCount = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const readTime = Math.ceil(wordCount / 200);

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: post.title, description: post.excerpt,
    datePublished: post.date, dateModified: post.date,
    author: { '@type': 'Person', name: post.author || 'SiliconFeed' },
    publisher: { '@type': 'Organization', name: 'SiliconFeed', logo: { '@type': 'ImageObject', url: 'https://siliconfeed.online/logo.png' } },
    ...(post.coverImage ? { image: [{ '@type': 'ImageObject', url: post.coverImage }] } : {}),
    mainEntityOfPage: `https://siliconfeed.online/news/${post.slug}`,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="article-container">
          <header className="article-head">
            {post.tags && post.tags.length > 0 && (
              <span className="article-tag">{post.tags[0]}</span>
            )}
            <h1 className="article-title">{post.title}</h1>
            <p className="article-excerpt">{post.excerpt}</p>
            <div className="article-meta">
              <span>By <strong>{post.author || 'SiliconFeed'}</strong></span>
              <span className="dot">·</span>
              <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
              <span className="dot">·</span>
              <span>{readTime} min read</span>
            </div>
          </header>

          {post.coverImage && (
            <figure className="article-cover">
              <img src={post.coverImage} alt={post.title} />
            </figure>
          )}

          <div className="article-body" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
