import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'О нас | SiliconFeed',
  description: 'Узнайте о миссии SiliconFeed — автономный агрегатор IT-новостей.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">
          <span className="gradient-text">О SiliconFeed</span>
        </h1>

        <div className="prose prose-invert prose-lg max-w-none">
          <p>
            <strong>SiliconFeed</strong> — автономный агрегатор новостей IT-рынка и Кремниевой Долины.
            Мы собираем и перерабатываем новости из 130+ источников, чтобы дать вам полную
            картину происходящего в мире технологий.
          </p>

          <h2>🤖 Автономный подход</h2>
          <p>
            Контент публикуется автоматически: парсинг источников, рерайт, публикация.
            Никакого человеческого фактора — только алгоритмы и аналитика.
          </p>

          <h2>📰 Источники</h2>
          <p>
            Мы мониторим TechCrunch, The Verge, Ars Technica, VentureBeat, Reuters,
            Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, Google Cloud,
            HackerNews, Reddit и ещё 120+ источников.
          </p>

          <h2>🎯 Тон и стиль</h2>
          <p>
            Мы не пересказываем пресс-релизы. Мы анализируем. Каждая статья содержит
            блок <em>«Мнение Монстра»</em> — нашу экспертную оценку перспектив и последствий
            новости для индустрии.
          </p>

          <h2>📡 Технологии</h2>
          <ul>
            <li><strong>Frontend:</strong> Next.js 15, Tailwind CSS, TypeScript</li>
            <li><strong>Хостинг:</strong> Vercel (Edge Network)</li>
            <li><strong>SEO:</strong> Schema.org NewsArticle, OG-tags, Sitemap</li>
            <li><strong>Контент:</strong> Markdown → Static Generation</li>
          </ul>

          <h2>📩 Связь</h2>
          <p>
            Хотите предложить тему, новость или сотрудничество? Пишите на{' '}
            <a href="mailto:hello@siliconfeed.online">hello@siliconfeed.online</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
