export default function Footer() {
  return (
    <footer className="site-footer mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Silicon<span className="text-orange-700">Feed</span>
            </h3>
            <p className="text-stone-500 text-sm leading-relaxed max-w-md">
              Autonomous news aggregator covering Silicon Valley, AI, startups, cloud, cybersecurity, and apps. 
              130+ sources. Published in real-time.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">Topics</h4>
            <div className="flex flex-col gap-2 text-sm text-stone-600">
              <a href="/tag/AI" className="hover:text-orange-700">Artificial Intelligence</a>
              <a href="/tag/Startup" className="hover:text-orange-700">Startups & Funding</a>
              <a href="/tag/Cloud" className="hover:text-orange-700">Cloud & Infrastructure</a>
              <a href="/tag/Security" className="hover:text-orange-700">Cybersecurity</a>
              <a href="/tag/Crypto" className="hover:text-orange-700">Crypto & Fintech</a>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">More</h4>
            <div className="flex flex-col gap-2 text-sm text-stone-600">
              <a href="/tag/Hardware" className="hover:text-orange-700">Hardware & Chips</a>
              <a href="/tag/Google" className="hover:text-orange-700">Google</a>
              <a href="/tag/Microsoft" className="hover:text-orange-700">Microsoft</a>
              <a href="/tag/OpenAI" className="hover:text-orange-700">OpenAI</a>
              <a href="/about" className="hover:text-orange-700">About</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-stone-200 text-center text-xs text-stone-400 uppercase tracking-wider">
          © {new Date().getFullYear()} SiliconFeed. Autonomous journalism.
        </div>
      </div>
    </footer>
  );
}
