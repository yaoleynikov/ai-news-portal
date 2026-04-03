import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const featured = allPosts[0];
  const secondary = allPosts.slice(1, 5);
  const latest = allPosts.slice(5);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Featured / Hero */}
        {featured && (
          <a
            href={`/news/${featured.slug}`}
            className="featured-article mb-12 group block text-inherit no-underline"
          >
            <div className="featured-image">
              {featured.coverImage ? (
                <img
                  src={featured.coverImage}
                  alt={featured.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-stone-100 to-stone-200" />
              )}
            </div>
            <div className="featured-body">
              <div className="flex items-center gap-3 mb-4">
                <span className="tag">
                  {featured.tags?.[0] || 'News'}
                </span>
                <span className="timestamp">
                  {new Date(featured.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4 group-hover:text-orange-700 transition-colors" style={{ fontFamily: 'Georgia, serif' }}>
                {featured.title}
              </h2>
              <p className="text-stone-600 leading-relaxed line-clamp-3">
                {featured.excerpt}
              </p>
            </div>
          </a>
        )}

        {/* Two-column: secondary + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Secondary articles — 2 col */}
          <div className="lg:col-span-2">
            <div className="section-header">
              <h2>Top Stories</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {secondary.map(post => (
                <a
                  key={post.slug}
                  href={`/news/${post.slug}`}
                  className="article-card group block text-inherit no-underline"
                >
                  {post.coverImage && (
                    <div className="card-image">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="card-body">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="tag">{post.tags?.[0] || 'News'}</span>
                      <span className="timestamp">
                        {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4">
                  About SiliconFeed
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-4">
                  Autonomous news aggregator covering the tech industry. AI, startups, cloud, security — 130+ sources, published in real-time.
                </p>
                <a href="/about" className="text-sm font-medium text-orange-700 hover:text-orange-800">
                  Learn more →
                </a>
              </div>

              <div className="bg-stone-50 border border-stone-200 p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 mb-4">
                  Popular Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['AI', 'Startups', 'Cloud', 'Security', 'Google', 'Microsoft', 'OpenAI', 'Crypto'].map(tag => (
                    <a
                      key={tag}
                      href={`/tag/${tag}`}
                      className="px-3 py-1 text-xs bg-white border border-stone-200 rounded-full hover:border-orange-300 hover:text-orange-700 transition-all"
                    >
                      {tag}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Latest — horizontal list */}
        {latest.length > 0 && (
          <section>
            <div className="section-header">
              <h2>Latest</h2>
            </div>
            <div className="divide-y divide-stone-200">
              {latest.map(post => (
                <a
                  key={post.slug}
                  href={`/news/${post.slug}`}
                  className="group flex items-start gap-5 py-5 no-underline text-inherit hover:bg-stone-50/50 -mx-4 px-4 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="tag text-xs">{post.tags?.[0] || 'News'}</span>
                      <span className="timestamp">
                        {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium leading-snug group-hover:text-orange-700 transition-colors truncate" style={{ fontFamily: 'Georgia, serif' }}>
                      {post.title}
                    </h3>
                    <p className="text-stone-500 text-sm mt-1 line-clamp-2">
                      {post.excerpt}
                    </p>
                  </div>
                  {post.coverImage && (
                    <div className="flex-shrink-0 w-28 h-20 md:w-36 md:h-24 overflow-hidden rounded bg-stone-100">
                      <img
                        src={post.coverImage}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
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
