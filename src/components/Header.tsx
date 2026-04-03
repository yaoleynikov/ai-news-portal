import Link from 'next/link';

const T = [
  { slug: 'all', label: '■ all' },
  { slug: 'ai', label: '○ ai' },
  { slug: 'startups', label: '○ startups' },
  { slug: 'cloud', label: '○ cloud' },
  { slug: 'security', label: '○ security' },
  { slug: 'crypto', label: '○ crypto' },
  { slug: 'hardware', label: '○ hardware' },
];

function tt() { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).toUpperCase(); }

export default function Header() {
  return (
    <div>
      <div className="top">
        <div className="top-left">
          <span className="live-dot" />
          <span className="top-time">{tt()}</span>
        </div>
        <Link href="/" className="top-logo">silicon<span>feed</span></Link>
        <div className="top-right">
          <Link href="/about">about</Link>
          <Link href="/rss.xml">rss</Link>
        </div>
      </div>
      <div className="ticker">
        {T.map(t => (
          <a key={t.slug} href={`/tag/${t.slug}`} className="ticker-item">{t.label}</a>
        ))}
      </div>
    </div>
  );
}
