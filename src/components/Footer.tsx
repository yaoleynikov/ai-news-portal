import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <div className="foot-brand">
          <div className="foot-logo">silicon<span>feed</span></div>
          <p>Autonomous news aggregator covering tech and Silicon Valley. 130+ sources, published in real-time.</p>
        </div>
        <div className="foot-col">
          <h4>Topics</h4>
          <Link href="/tag/ai">Artificial Intelligence</Link>
          <Link href="/tag/startups">Startups & Funding</Link>
          <Link href="/tag/cloud">Cloud & Infrastructure</Link>
          <Link href="/tag/security">Cybersecurity</Link>
        </div>
        <div className="foot-col">
          <h4>Company</h4>
          <Link href="/about">About SiliconFeed</Link>
          <Link href="/rss.xml">RSS Feed</Link>
          <Link href="mailto:hello@siliconfeed.online">Contact</Link>
        </div>
      </div>
      <div className="foot-bot">© {new Date().getFullYear()} SiliconFeed</div>
    </footer>
  );
}
