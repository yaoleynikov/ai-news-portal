import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsCard from '@/components/NewsCard';
import { getSortedPosts } from '@/lib/posts';

export const metadata = {
  title: 'All News | SiliconFeed',
  description: 'Full list of tech news on SiliconFeed.',
};

export default async function AllPostsPage() {
  const allPosts = getSortedPosts();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-3">
          <span className="gradient-text">All News</span>
          <span className="text-text-dim text-lg font-normal">({allPosts.length})</span>
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allPosts.map(post => (
            <NewsCard key={post.slug} post={post} />
          ))}
        </div>
        {allPosts.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-xl">No news yet</p>
            <p className="text-sm mt-2">Fresh tech stories coming soon</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
