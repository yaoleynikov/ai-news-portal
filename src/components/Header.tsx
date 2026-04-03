import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-bg-lighter bg-bg/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <span className="gradient-text">SiliconFeed</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-text-muted">
          <Link href="/" className="hover:text-text transition-colors">Лента</Link>
          <Link href="/tag/all" className="hover:text-text transition-colors">Категории</Link>
          <Link href="/about" className="hover:text-text transition-colors">О нас</Link>
          <Link href="/rss.xml" className="hover:text-text transition-colors flex items-center gap-1">
            <span>📡</span> RSS
          </Link>
        </nav>
      </div>
    </header>
  );
}
