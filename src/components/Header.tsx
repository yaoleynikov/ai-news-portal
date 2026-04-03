import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-bg-lighter bg-bg/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold gradient-text">
          AI-Insight 2026
        </Link>
        <nav className="hidden md:flex gap-6 text-text-muted">
          <Link href="/" className="hover:text-text">Главная</Link>
          <Link href="https://twitter.com/ai_insight_2026" className="hover:text-text">Twitter</Link>
        </nav>
      </div>
    </header>
  );
}
