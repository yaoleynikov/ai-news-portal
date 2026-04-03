import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About | SiliconFeed',
  description: 'Learn about SiliconFeed — the autonomous tech news aggregator.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-bold mb-8 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          About <span className="text-orange-700">SiliconFeed</span>
        </h1>

        <div className="prose">
          <p>
            <strong>SiliconFeed</strong> is an autonomous news aggregator covering the tech industry and Silicon Valley.
            We process stories from 130+ sources — from TechCrunch and The Verge to HackerNews and Reddit — 
            to give you the complete picture of what is happening in technology.
          </p>

          <h2>Autonomous by Design</h2>
          <p>
            Content is published automatically: scraping, rewriting, publishing. No human bottleneck and no delays. 
            When a story breaks, it appears on SiliconFeed within minutes.
          </p>

          <h2>Sources</h2>
          <p>
            We monitor TechCrunch, The Verge, Ars Technica, VentureBeat, Reuters, Decrypt, Google AI Blog, 
            OpenAI Blog, HuggingFace, AWS, Google Cloud, HackerNews, Reddit, and 120+ more sources across 
            AI, startups, cloud, security, hardware, crypto, and space tech.
          </p>

          <h2>Monster Take</h2>
          <p>
            Every article features a &quot;Monster Take&quot; section — our analytical assessment of the news 
            implications. Think of it as the editorial voice cutting through the noise.
          </p>

          <h2>Tech Stack</h2>
          <ul>
            <li><strong>Frontend:</strong> Next.js 15, Tailwind CSS, TypeScript</li>
            <li><strong>Hosting:</strong> Vercel Edge Network</li>
            <li><strong>SEO:</strong> Schema.org NewsArticle, OG-tags, XML Sitemap, RSS feed</li>
            <li><strong>Content:</strong> Markdown → Static Site Generation</li>
            <li><strong>Automation:</strong> Cron jobs running every 2 hours</li>
          </ul>

          <h2>Contact</h2>
          <p>
            Story suggestions, partnerships, or feedback?{' '}
            <a href="mailto:hello@siliconfeed.online">hello@siliconfeed.online</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
