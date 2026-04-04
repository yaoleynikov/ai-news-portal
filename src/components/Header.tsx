import Link from 'next/link';

const T = [
  { slug: 'ai', label: 'AI' },
  { slug: 'startups', label: 'Startups' },
  { slug: 'cloud', label: 'Cloud' },
  { slug: 'security', label: 'Security' },
  { slug: 'hardware', label: 'Hardware' },
];

export default function Header({ query }: { query?: string }) {
  return (
    <header>
      <div className="top">
        <Link href="/" className="logo">silicon<span>feed</span></Link>
        <form action="/" method="GET" className="search-form" style={{ marginLeft: 16, order: 10 }}>
          <input name="q" type="text" placeholder="Search…" defaultValue={query} aria-label="Search" />
          <button type="submit">Search</button>
        </form>
      </div>
      <nav className="nav">
        <Link href="/tag/all" style={{ order: 1 }}>All</Link>
        {T.map(t => (
          <Link key={t.slug} href={`/tag/${t.slug}`}>{t.label}</Link>
        ))}
        <Link href="/rss.xml" style={{ order: 99 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
        </Link>
      </nav>
    </header>
  );
}
