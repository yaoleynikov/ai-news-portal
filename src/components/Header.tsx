const CATEGORIES = [
  { slug: 'all', label: 'All', emoji: '🔥' },
  { slug: 'AI', label: 'AI', emoji: '🤖' },
  { slug: 'Startup', label: 'Startups', emoji: '🚀' },
  { slug: 'Cloud', label: 'Cloud', emoji: '☁️' },
  { slug: 'Security', label: 'Security', emoji: '🔒' },
  { slug: 'Google', label: 'Google', emoji: '🔍' },
  { slug: 'Microsoft', label: 'Microsoft', emoji: '🪟' },
  { slug: 'OpenAI', label: 'OpenAI', emoji: '🧠' },
  { slug: 'Crypto', label: 'Crypto', emoji: '₿' },
  { slug: 'Hardware', label: 'Hardware', emoji: '💻' },
];

import Link from 'next/link';

export default function Header() {
  return (
    <header className="site-header">
      {/* Top bar — thin, clean */}
      <div className="border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-stone-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <nav className="site-nav flex items-center gap-5">
            <Link href="/about">About</Link>
            <Link href="/rss.xml">RSS</Link>
          </nav>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-1 group">
          <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Silicon<span className="text-orange-700">Feed</span>
          </span>
        </Link>
        <nav className="site-nav hidden md:flex items-center gap-6">
          <Link href="/tag/ai">AI</Link>
          <Link href="/tag/startup">Startups</Link>
          <Link href="/tag/cloud">Cloud</Link>
          <Link href="/tag/security">Security</Link>
          <Link href="/tag/all">All</Link>
        </nav>
      </div>

      {/* Category ticker */}
      <div className="border-t border-b border-stone-100 bg-stone-50/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <a key={cat.slug} href={`/tag/${cat.slug}`} className="category-pill">
                {cat.emoji} {cat.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

const CATEGORIES = [
  { slug: 'all', label: 'All', emoji: '🔥' },
  { slug: 'AI', label: 'AI', emoji: '🤖' },
  { slug: 'Startup', label: 'Startups', emoji: '🚀' },
  { slug: 'Cloud', label: 'Cloud', emoji: '☁️' },
  { slug: 'Security', label: 'Security', emoji: '🔒' },
  { slug: 'Google', label: 'Google', emoji: '🔍' },
  { slug: 'Microsoft', label: 'Microsoft', emoji: '🪟' },
  { slug: 'OpenAI', label: 'OpenAI', emoji: '🧠' },
  { slug: 'Crypto', label: 'Crypto', emoji: '₿' },
  { slug: 'Hardware', label: 'Hardware', emoji: '💻' },
];
