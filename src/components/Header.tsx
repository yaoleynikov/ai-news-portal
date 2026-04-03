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

export default function Header() {
  return (
    <div>
      <div className="top">
        <Link href="/" className="top-logo">silicon<span>feed</span></Link>
      </div>
      <div className="tapes">
        {T.map(t => (
          <a key={t.slug} href={`/tag/${t.slug}`} className="tape">{t.label}</a>
        ))}
      </div>
    </div>
  );
}
