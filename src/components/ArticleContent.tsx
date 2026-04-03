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
    publisher: {
      '@type': 'Organization',
      name: 'SiliconFeed',
      logo: { '@type': 'ImageObject', url: 'https://siliconfeed.online/logo.png' },
    },
    ...(post.coverImage ? { image: [{ '@type': 'ImageObject', url: post.coverImage }] } : {}),
    mainEntityOfPage: `https://siliconfeed.online/news/${post.slug}`,
  };

  const wordCount = Math.ceil((post.rawContent || '').length / 5);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="max-w-3xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-4">
          {post.tags && post.tags.length > 0 && (
            <>
              <a href={`/tag/${post.tags[0]}`} className="tag">{post.tags[0]}</a>
              <span className="text-stone-300">·</span>
            </>
          )}
          <time className="timestamp">
            {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </time>
          <span className="text-stone-300">·</span>
          <span className="timestamp">{readTime} min read</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <span>By {post.author || 'SiliconFeed'}</span>
        </div>
      </header>

      {post.coverImage && (
        <figure className="max-w-4xl mx-auto mb-10">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: '480px' }}
          />
        </figure>
      )}

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </>
  );
}
