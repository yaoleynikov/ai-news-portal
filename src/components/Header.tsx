import Link from 'next/link';

export default function Header() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const cats = [
    { slug: 'all', label: 'All', emoji: '🔥' },
    { slug: 'ai', label: 'AI', emoji: '🤖' },
    { slug: 'startups', label: 'Startups', emoji: '🚀' },
    { slug: 'cloud', label: 'Cloud', emoji: '☁️' },
    { slug: 'security', label: 'Security', emoji: '🔒' },
    { slug: 'crypto', label: 'Crypto', emoji: '₿' },
  ];

  return (
    <header className="site-header">
      <div className="max-w-6xl mx-auto px-4">
        <div className="header-top">
          <span className="header-date">{dateStr}</span>
          <Link href="/" className="site-logo">Silicon<span>Feed</span></Link>
          <nav className="site-nav">
            <Link href="/about">About</Link>
            <Link href="/rss.xml">RSS</Link>
          </nav>
        </div>

        <div className="categories-bar">
          {cats.map(c => (
            <a key={c.slug} href={`/tag/${c.slug}`} className="cat-pill">
              <span>{c.emoji}</span><span>{c.label}</span>
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
