import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Placeholder gradient backgrounds for articles without covers
const gradients = [
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #dbeafe, #93c5fd)',
  'linear-gradient(135deg, #fce7f3, #f9a8d4)',
  'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
  'linear-gradient(135deg, #d1fae5, #6ee7b7)',
];

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const featured = allPosts[0];
  const secondary = allPosts.slice(1, 5);
  const latest = allPosts.slice(5);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Featured Article - full-width hero */}
        {featured && (
          <a
            href={`/news/${featured.slug}`}
            className="featured-article mb-10 group block text-inherit no-underline"
          >
            <div className="featured-image">
              <img src={featured.coverImage} alt={featured.title} />
            </div>
            <div className="featured-body">
              <div className="flex items-center gap-3 mb-3">
                <span className="tag">{featured.tags?.[0] || 'Technology'}</span>
                <span className="timestamp">
                  {new Date(featured.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold leading-tight mb-3 group-hover:text-orange-700 transition-colors" style={{ fontFamily: 'Georgia, serif' }}>
                {featured.title}
              </h2>
              <p className="text-stone-600 text-base md:text-lg leading-relaxed max-w-3xl line-clamp-3">
                {featured.excerpt}
              </p>
            </div>
          </a>
        )}

        {/* Two-column: secondary + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Secondary articles */}
          <div className="lg:col-span-2">
            <div className="section-header">
              <h2>Top Stories</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {secondary.map((post, i) => (
                <a
                  key={post.slug}
                  href={`/news/${post.slug}`}
                  className="article-card group block text-inherit no-underline"
                >
                  <div className="card-image">
                    {post.coverImage ? (
                      <img src={post.coverImage} alt={post.title} loading="lazy" />
                    ) : (
                      <div className="w-full h-full" style={{ background: gradients[i % gradients.length] }} />
                    )}
                  </div>
                  <div className="card-body">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="tag">{post.tags?.[0] || 'News'}</span>
                      <span className="timestamp">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <h3 className="text-lg font-bold leading-snug mb-2 group-hover:text-orange-700 transition-colors" style={{ fontFamily: 'Georgia, serif' }}>
                      {post.title}
                    </h3>
                    <p className="text-stone-500 text-sm leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white border border-stone-200 p-6 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4">About SiliconFeed</h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-4">
                  Autonomous tech news aggregator. 130+ sources, published in real-time.
                </p>
                <a href="/about" className="text-sm font-medium text-orange-700 hover:text-orange-800">Learn more →</a>
              </div>

              <div className="bg-stone-50 border border-stone-200 p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4">Popular Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {['AI', 'Startups', 'Cloud', 'Security', 'Google', 'OpenAI', 'Funding'].map(tag => (
                    <a key={tag} href={`/tag/${tag.toLowerCase()}`} className="px-3 py-1 text-xs bg-white border border-stone-200 rounded-full hover:border-orange-300 hover:text-orange-700 transition-all">
                      {tag}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Latest */}
        {latest.length > 0 && (
          <section>
            <div className="section-header"><h2>Latest</h2></div>
            <div>
              {latest.map((post, i) => (
                <a key={post.slug} href={`/news/${post.slug}`} className="latest-item group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="tag text-xs">{post.tags?.[0] || 'News'}</span>
                      <span className="timestamp">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <h3 className="text-lg font-medium leading-snug group-hover:text-orange-700 transition-colors truncate" style={{ fontFamily: 'Georgia, serif' }}>
                      {post.title}
                    </h3>
                    <p className="text-stone-500 text-sm mt-1 line-clamp-2">{post.excerpt}</p>
                  </div>
                  {post.coverImage && (
                    <div className="latest-image flex-shrink-0">
                      <img src={post.coverImage} alt="" loading="lazy" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: 'SiliconFeed — Silicon Valley & IT News Feed',
    description: 'Autonomous aggregator of tech news: AI, startups, cloud, cybersecurity, apps.',
  };
}
