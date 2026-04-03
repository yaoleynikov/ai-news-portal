interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  coverImage?: string;
  author?: string;
  tags?: string[];
  contentHtml: string;
  rawContent?: string;
}

export default function ArticleContent({ post }: { post: Post }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Person', name: post.author || 'SiliconFeed' },
    publisher: { '@type': 'Organization', name: 'SiliconFeed', logo: { '@type': 'ImageObject', url: 'https://siliconfeed.online/logo.png' } },
    ...(post.coverImage ? { image: [{ '@type': 'ImageObject', url: post.coverImage }] } : {}),
    mainEntityOfPage: `https://siliconfeed.online/news/${post.slug}`,
  };

  const wordCount = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      <article style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header - left aligned, editorial */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {post.tags && post.tags.length > 0 && (
              <a href={`/tag/${post.tags[0]}`} className="tag">{post.tags[0]}</a>
            )}
            <time className="timestamp">{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
            <span className="text-stone-400">·</span>
            <span className="timestamp">{readTime} min read</span>
          </div>
          
          <h1 className="text-3xl md:text-[2.5rem] font-bold leading-[1.15] mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            {post.title}
          </h1>
          
          <p className="text-lg text-stone-500 leading-relaxed mb-4">{post.excerpt}</p>
          
          <div className="flex items-center gap-3 text-sm text-stone-500 pb-8 border-b border-stone-200">
            <span>By <strong className="text-stone-700">{post.author || 'SiliconFeed'}</strong></span>
          </div>
        </header>

        {/* Cover image - full width */}
        {post.coverImage && (
          <figure className="mb-10 -mx-4 md:-mx-8 lg:-mx-16">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full object-cover"
              style={{ maxHeight: '520px' }}
            />
          </figure>
        )}

        {/* Article body */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </article>
    </>
  );
}
