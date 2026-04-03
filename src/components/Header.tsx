import Link from 'next/link';

const TICKERS = [
  { slug: 'all', label: 'all' },
  { slug: 'ai', label: 'ai' },
  { slug: 'startups', label: 'startups' },
  { slug: 'cloud', label: 'cloud' },
  { slug: 'security', label: 'security' },
  { slug: 'crypto', label: 'crypto' },
  { slug: 'hardware', label: 'hardware' },
];

function fmtShortTime() {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).toUpperCase();
}

export default function Header() {
  return (
    <div>
      <header className="topbar">
        <div className="topbar-time">{fmtShortTime()}</div>
        <Link href="/" className="logo">siliconfeed</Link>
        <nav className="topbar-nav">
          <Link href="/about">about</Link>
          <Link href="/rss.xml">rss</Link>
        </nav>
      </header>

      <div className="ticker">
        <div className="ticker-label">feed</div>
        <div className="ticker-track">
          {TICKERS.map(t => (
            <a key={t.slug} href={`/tag/${t.slug}`} className="ticker-item">
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
