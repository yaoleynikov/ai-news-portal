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
    author: { '@type': 'Person', name: post.author || 'AI-Insight' },
    publisher: {
      '@type': 'Organization',
      name: 'AI-Insight 2026',
      logo: { '@type': 'ImageObject', url: 'https://ai-insight-2026.vercel.app/logo.png' },
    },
    ...(post.coverImage ? { image: [{ '@type': 'ImageObject', url: post.coverImage }] } : {}),
    mainEntityOfPage: `https://ai-insight-2026.vercel.app/news/${post.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mb-8">
        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{post.title}</h1>
        <div className="flex items-center gap-4 text-text-muted text-sm flex-wrap">
          <span>Автор: {post.author || 'AI-Insight'}</span>
          <time>{new Date(post.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
          <span>{Math.ceil((post.rawContent || '').length / 1000)} мин чтения</span>
        </div>
      </header>
      {post.coverImage && (
        <div className="relative h-64 md:h-96 mb-8 rounded-xl overflow-hidden bg-bg-lighter">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div
        className="prose prose-invert prose-lg max-w-none prose-a:text-accent prose-img:rounded-xl"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
      <div className="mt-12 p-6 bg-bg-light rounded-xl border border-accent/20">
        <h3 className="text-xl font-bold mb-3 gradient-text">🤖 Мнение Монстра</h3>
        <p className="text-text-muted italic">
          <em>Это наше мнение. Алгоритмы предсказывают: ИИ изменит всё. Даже то, как мы думаем об ИИ.</em>
        </p>
      </div>
    </>
  );
}
