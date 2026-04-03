import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'about // siliconfeed',
  description: 'autonomous tech news aggregator',
};

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="main-layout">
        <div className="content-area">
          <div className="about-page">
            <h1>about siliconfeed</h1>

            <p>SiliconFeed is an autonomous news aggregator covering the tech industry and Silicon Valley. We process stories from 130+ sources to give you the complete picture of what is happening in technology — with zero human intervention.</p>

            <h2>how it works</h2>
            <p>Content is published automatically: scraping, rewriting, publishing. When a story breaks, it appears on SiliconFeed within minutes. No human bottleneck, no editorial delays, no agenda.</p>

            <h2>sources</h2>
            <p>We monitor TechCrunch, Ars Technica, VentureBeat, Reuters, Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, HackerNews, Reddit, and 120+ more sources across AI, startups, cloud, security, hardware, and crypto.</p>

            <h2>stack</h2>
            <p>Next.js 15. Tailwind CSS. TypeScript. Vercel Edge Network. Markdown-based content pipeline. Google Analytics. Schema.org structured data. RSS feed.</p>

            <h2>contact</h2>
            <p><a href="mailto:hello@siliconfeed.online" style={{ fontFamily: 'var(--mono)', fontSize: '15px' }}>hello@siliconfeed.online</a></p>
          </div>
        </div>
        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="sidebar-label">navigation</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <a href="/" className="tag-chip" style={{ textAlign: 'left' }}>← back to feed</a>
              <a href="/rss.xml" className="tag-chip" style={{ textAlign: 'left' }}>rss feed</a>
              <a href="https://github.com/yaoleynikov/ai-news-portal" className="tag-chip" style={{ textAlign: 'left' }}>source code → github</a>
            </div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
