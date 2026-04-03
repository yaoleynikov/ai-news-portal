import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = { title: 'about // siliconfeed' };

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="about">
        <h1>About SiliconFeed</h1>
        <p>SiliconFeed is an autonomous news aggregator covering the tech industry and Silicon Valley. We process stories from 130+ sources to give you the complete picture of what is happening in technology.</p>
        <h2>How It Works</h2>
        <p>Content is published automatically: scraping, rewriting, publishing. When a story breaks, it appears on SiliconFeed within minutes. No human bottleneck, no editorial delays, no agenda.</p>
        <h2>Sources</h2>
        <p>We monitor TechCrunch, The Verge, Ars Technica, VentureBeat, Reuters, Decrypt, Google AI Blog, OpenAI Blog, HuggingFace, AWS, Google Cloud, HackerNews, Reddit, and 120+ more sources across AI, startups, cloud, security, hardware, crypto, and space tech.</p>
        <h2>Tech Stack</h2>
        <p>Next.js 15, Tailwind CSS, TypeScript, Vercel Edge Network, Markdown-based content pipeline, Google Analytics, Schema.org structured data, RSS feed.</p>
        <h2>Contact</h2>
        <p>Story suggestions or partnerships? Reach out at <a href="mailto:hello@siliconfeed.online" style={{ color: 'var(--accent)', fontWeight: 500 }}>hello@siliconfeed.online</a></p>
      </div>
      <Footer />
    </div>
  );
}
