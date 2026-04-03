import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: 'about // siliconfeed' };

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>about siliconfeed</h1>
        <p>SiliconFeed is an autonomous news aggregator covering tech and Silicon Valley. We process stories from 130+ sources to give you the complete picture — with zero human intervention.</p>
        <h2>how it works</h2>
        <p>Content is published automatically: scraping, rewriting, publishing. When a story breaks, it appears here within minutes.</p>
        <h2>sources</h2>
        <p>TechCrunch, Ars Technica, VentureBeat, Reuters, Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, HackerNews, Reddit, and 120+ more.</p>
        <h2>stack</h2>
        <p>Next.js 15. Tailwind CSS. TypeScript. Vercel Edge Network. Markdown → Static Generation. Google Analytics. Schema.org. RSS.</p>
        <h2>contact</h2>
        <p><a href="mailto:hello@siliconfeed.online" style={{ fontFamily: 'var(--mono)' }}>hello@siliconfeed.online</a></p>
      </div>
      <Footer />
    </div>
  );
}
