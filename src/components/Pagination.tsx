import Link from 'next/link';

export default function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex justify-center items-center gap-2 mt-8">
      {currentPage > 1 && (
        <Link href={`/?page=${currentPage - 1}`} className="px-4 py-2 bg-bg-lighter rounded-lg hover:bg-surface transition">
          ← Назад
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <span key={page} className={`px-3 py-1 rounded ${page === currentPage ? 'bg-accent text-white' : 'bg-bg-lighter hover:bg-surface'}`}>
          {page === currentPage ? <span>{page}</span> : <Link href={`/?page=${page}`}>{page}</Link>}
        </span>
      ))}
      {currentPage < totalPages && (
        <Link href={`/?page=${currentPage + 1}`} className="px-4 py-2 bg-bg-lighter rounded-lg hover:bg-surface transition">
          Вперёд →
        </Link>
      )}
    </nav>
  );
}
