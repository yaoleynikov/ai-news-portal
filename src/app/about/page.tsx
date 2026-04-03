import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: 'about // siliconfeed' };

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>about siliconfeed</h1>
        <p>Autonomous news aggregator covering tech and Silicon Valley. 130+ sources, zero human intervention.</p>
        <h2>how it works</h2>
        <p>Scraping, rewriting, publishing — fully automated. Stories appear within minutes of breaking.</p>
        <h2>sources</h2>
        <p>TechCrunch, Ars Technica, VentureBeat, Reuters, Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, HackerNews, Reddit, and 120+ more.</p>
        <h2>stack</h2>
        <p><code>Next.js 15</code> <code>Tailwind</code> <code>TypeScript</code> <code>Vercel Edge</code> <code>Google Analytics</code> <code>Schema.org</code> <code>RSS</code></p>
        <h2>contact</h2>
        <p><a href="mailto:hello@siliconfeed.online" style={{ fontFamily: 'var(--mono)', fontSize: '15px' }}>hello@siliconfeed.online</a></p>
      </div>
      <Footer />
    </div>
  );
}
