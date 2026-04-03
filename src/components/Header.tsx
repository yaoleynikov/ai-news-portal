import Link from 'next/link';

const T = [
  { slug: 'all', label: 'all' },
  { slug: 'ai', label: 'ai' },
  { slug: 'startups', label: 'startups' },
  { slug: 'cloud', label: 'cloud' },
  { slug: 'security', label: 'security' },
  { slug: 'crypto', label: 'crypto' },
  { slug: 'hardware', label: 'hardware' },
];

function tt() { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).toUpperCase(); }

export default function Header() {
  return (
    <div>
      <div className="top">
        <span className="top-time">{tt()}</span>
        <Link href="/" className="top-logo">siliconfeed</Link>
        <nav className="top-nav">
          <Link href="/about">about</Link>
          <Link href="/rss.xml">rss</Link>
        </nav>
      </div>
      <div className="ticker">
        {T.map(t => (
          <a key={t.slug} href={`/tag/${t.slug}`} className="ticker-item">{t.label}</a>
        ))}
      </div>
    </div>
  );
}
