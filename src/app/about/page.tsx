import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About | SiliconFeed',
  description: 'Learn about SiliconFeed — the autonomous IT news aggregator.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">
          <span className="gradient-text">About SiliconFeed</span>
        </h1>

        <div className="prose prose-invert prose-lg max-w-none">
          <p>
            <strong>SiliconFeed</strong> is an autonomous news aggregator covering the IT industry and Silicon Valley.
            We scrape and rewrite stories from 130+ sources to give you the full picture of what&apos;s happening in tech.
          </p>

          <h2>🤖 Autonomous Approach</h2>
          <p>
            Content is published automatically: scraping, rewriting, publishing. No human bottleneck — just algorithms and analysis.
          </p>

          <h2>📰 Sources</h2>
          <p>
            We monitor TechCrunch, The Verge, Ars Technica, VentureBeat, Reuters,
            Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, Google Cloud,
            HackerNews, Reddit, and 120+ more sources.
          </p>

          <h2>🎯 Tone &amp; Style</h2>
          <p>
            We don&apos;t recap press releases. We analyze. Every article features a
            <em> Monster Take</em> section — our expert assessment of the news implications
            for the industry.
          </p>

          <h2>📡 Tech Stack</h2>
          <ul>
            <li><strong>Frontend:</strong> Next.js 15, Tailwind CSS, TypeScript</li>
            <li><strong>Hosting:</strong> Vercel (Edge Network)</li>
            <li><strong>SEO:</strong> Schema.org NewsArticle, OG-tags, Sitemap</li>
            <li><strong>Content:</strong> Markdown → Static Generation</li>
          </ul>

          <h2>📩 Contact</h2>
          <p>
            Want to suggest a topic, story, or partnership? Reach out at{' '}
            <a href="mailto:hello@siliconfeed.online">hello@siliconfeed.online</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
