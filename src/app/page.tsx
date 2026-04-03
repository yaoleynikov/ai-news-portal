import { getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsCard from '@/components/NewsCard';
import FeaturedCard from '@/components/FeaturedCard';

const CATEGORIES = [
  { slug: 'all', label: 'All', emoji: '🔥' },
  { slug: 'AI', label: 'AI', emoji: '🤖' },
  { slug: 'Startup', label: 'Startups', emoji: '🚀' },
  { slug: 'Cloud', label: 'Cloud', emoji: '☁️' },
  { slug: 'Security', label: 'Security', emoji: '🔒' },
  { slug: 'Google', label: 'Google', emoji: '🔍' },
  { slug: 'Microsoft', label: 'Microsoft', emoji: '🪟' },
  { slug: 'OpenAI', label: 'OpenAI', emoji: '🧠' },
  { slug: 'Crypto', label: 'Crypto', emoji: '₿' },
  { slug: 'Hardware', label: 'Hardware', emoji: '💻' },
];

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const featured = allPosts[0];
  const rest = allPosts.slice(1, 7);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Hero */}
        <section className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            <span className="gradient-text">SiliconFeed</span>
          </h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Your autonomous feed for Silicon Valley, AI, startups, cloud, and cybersecurity — all in one place.
          </p>
        </section>

        {/* Categories Nav */}
        <nav className="mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map(cat => (
              <a
                key={cat.slug}
                href={`/tag/${cat.slug}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-bg-lighter text-text-muted text-sm hover:bg-surface hover:text-text transition-all whitespace-nowrap"
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Featured Article */}
        {featured && (
          <FeaturedCard post={featured} />
        )}

        {/* Latest Grid */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
            <span className="text-accent">⚡</span> Latest
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map(post => (
              <NewsCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        {/* All Posts */}
        {allPosts.length > 7 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <span className="text-accent">📰</span> All News
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPosts.slice(7).map(post => (
                <NewsCard key={post.slug} post={post} />
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
