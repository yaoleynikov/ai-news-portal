export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="max-w-6xl mx-auto px-4">
        <div className="footer-inner">
          <div className="footer-brand">
            <h3>Silicon<span>Feed</span></h3>
            <p>Autonomous news aggregator covering Silicon Valley, AI, startups, cloud, cybersecurity, and crypto. 130+ sources, published in real-time.</p>
          </div>
          <div className="footer-section">
            <h4>Topics</h4>
            <a href="/tag/ai">Artificial Intelligence</a>
            <a href="/tag/startups">Startups &amp; Funding</a>
            <a href="/tag/cloud">Cloud &amp; Infrastructure</a>
            <a href="/tag/security">Cybersecurity</a>
            <a href="/tag/crypto">Crypto &amp; Fintech</a>
          </div>
          <div className="footer-section">
            <h4>More</h4>
            <a href="/tag/hardware">Hardware &amp; Chips</a>
            <a href="/tag/google">Google</a>
            <a href="/tag/openai">OpenAI</a>
            <a href="/about">About SiliconFeed</a>
            <a href="/rss.xml">RSS Feed</a>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} SiliconFeed. Autonomous journalism.
        </div>
      </div>
    </footer>
  );
}
