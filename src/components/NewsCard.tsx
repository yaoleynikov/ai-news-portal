import Link from 'next/link';
import Image from 'next/image';

interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  coverImage?: string;
  tags?: string[];
}

export default function NewsCard({ post, priority = false }: { post: Post; priority?: boolean }) {
  return (
    <article className="group bg-bg-light rounded-xl border border-bg-lighter overflow-hidden hover:border-accent/30 transition-all duration-300 glow-effect">
      {post.coverImage ? (
        <Link href={`/news/${post.slug}`}>
          <div className="relative h-48 overflow-hidden bg-bg-lighter">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              priority={priority}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        </Link>
      ) : (
        <div className="h-2 bg-gradient-to-r from-accent/20 via-purple-500/20 to-accent/20" />
      )}
      <div className="p-5">
        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link href={`/news/${post.slug}`}>
          <h2 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>
        <p className="text-text-muted text-sm line-clamp-3 mb-3">{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-text-dim">
          <time>{new Date(post.date).toLocaleDateString('ru-RU')}</time>
          <Link href={`/news/${post.slug}`} className="text-accent hover:underline">
            Читать →
          </Link>
        </div>
      </div>
    </article>
  );
}
