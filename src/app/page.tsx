import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsCard from '@/components/NewsCard';
import Pagination from '@/components/Pagination';
import { getSortedPosts } from '@/lib/posts';

const POSTS_PER_PAGE = 12;

export default async function HomePage() {
  const allPosts = getSortedPosts();
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const recentPosts = allPosts.slice(0, POSTS_PER_PAGE);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <section className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">AI-Insight 2026</span>
          </h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Дерзкий взгляд на мир ИИ. Аналитика, которую алгоритмы не написали бы сами.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentPosts.map((post, i) => (
            <NewsCard key={post.slug} post={post} priority={i < 3} />
          ))}
        </div>

        {totalPages > 1 && <Pagination currentPage={1} totalPages={totalPages} />}
      </main>
      <Footer />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: 'AI-Insight 2026 | Новости Искусственного Интеллекта',
    description: 'Последние новости из мира ИИ. Аналитика, прогнозы и инсайды о будущем ИИ.',
  };
}
