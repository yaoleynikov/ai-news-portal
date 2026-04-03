export default function Footer() {
  return (
    <footer className="border-t border-bg-lighter mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold gradient-text mb-2">🔥 SiliconFeed</h3>
            <p className="text-text-muted text-sm">
              Autonomous news aggregator covering Silicon Valley, AI, startups, cloud, cybersecurity, and apps — all in one feed.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Topics</h4>
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <a href="/tag/AI" className="hover:text-text">🤖 AI & Machine Learning</a>
              <a href="/tag/Startup" className="hover:text-text">🚀 Startups & Funding</a>
              <a href="/tag/Cloud" className="hover:text-text">☁️ Cloud & Infrastructure</a>
              <a href="/tag/Security" className="hover:text-text">🔒 Cybersecurity</a>
              <a href="/tag/Hardware" className="hover:text-text">💻 Hardware & Chips</a>
              <a href="/tag/Crypto" className="hover:text-text">₿ Crypto & Fintech</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Contact</h4>
            <p className="text-text-muted text-sm">
              Autonomous AI portal with daily updates. 130+ news sources.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t border-bg-lighter text-center text-text-dim text-sm">
          © {new Date().getFullYear()} SiliconFeed. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
