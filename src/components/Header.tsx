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

function fmtTime() {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).toUpperCase();
}

export default function Header() {
  return (
    <div>
      <div className="bar">
        <span className="bar-time">{fmtTime()}</span>
        <Link href="/" className="bar-logo">siliconfeed</Link>
        <nav className="bar-nav">
          <Link href="/about">about</Link>
          <Link href="/rss.xml">rss</Link>
        </nav>
      </div>
      <div className="tape-row">
        {TICKERS.map(t => (
          <a key={t.slug} href={`/tag/${t.slug}`} className="tape">{t.label}</a>
        ))}
      </div>
    </div>
  );
}
