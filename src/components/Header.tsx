import Link from 'next/link';

const T = [
  { slug: 'all', label: 'All' },
  { slug: 'ai', label: 'AI' },
  { slug: 'startups', label: 'Startups' },
  { slug: 'cloud', label: 'Cloud' },
  { slug: 'security', label: 'Security' },
  { slug: 'crypto', label: 'Crypto' },
  { slug: 'hardware', label: 'Hardware' },
];

export default function Header() {
  return (
    <header>
      <div className="top">
        <Link href="/" className="logo">silicon<span>feed</span></Link>
      </div>
      <nav className="nav">
        {T.map(t => (
          <a key={t.slug} href={`/tag/${t.slug}`} style={{ order: t.slug === 'all' ? -1 : 0 }}>{t.label}</a>
        ))}
        <a href="/about" style={{ marginLeft: 'auto', color: 'var(--text-d)', borderLeft: 'none' }}>About</a>
        <a href="/rss.xml" style={{ borderLeft: 'none', borderRight: '1px solid var(--line)' }}>RSS</a>
      </nav>
    </header>
  );
}
