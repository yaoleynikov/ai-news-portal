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

export default function FeaturedCard({ post }: { post: Post }) {
  const categoryEmojis: Record<string, string> = {
    'AI': '🤖', 'Startup': '🚀', 'Cloud': '☁️', 'Security': '🔒',
    'Google': '🔍', 'Microsoft': '🪟', 'OpenAI': '🧠', 'Crypto': '₿',
    'Hardware': '💻', 'Robotics': '🦾', 'LLM': '📝', 'Meta': '👥',
    'Anthropic': '⚡',
  };

  const categoryTags = post.tags?.slice(0, 3) || [];

  return (
    <article className="group relative rounded-2xl overflow-hidden border border-bg-lighter bg-bg-light glow-effect hover:border-accent/30 transition-all duration-500">
      {post.coverImage ? (
        <Link href={`/news/${post.slug}`}>
          <div className="relative h-64 md:h-80 overflow-hidden">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
          </div>
        </Link>
      ) : (
        <div className="h-32 bg-gradient-to-r from-accent/10 via-purple-500/10 to-accent/10" />
      )}
      <div className={post.coverImage ? 'absolute bottom-0 left-0 right-0 p-6 md:p-8' : 'p-6 md:p-8'}>
        {categoryTags.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {categoryTags.map(tag => (
              <span key={tag} className="text-xs bg-accent/20 text-accent px-3 py-1 rounded-full font-medium backdrop-blur-sm">
                {categoryEmojis[tag] || '📌'} {tag}
              </span>
            ))}
          </div>
        )}
        <Link href={`/news/${post.slug}`}>
          <h2 className={`${post.coverImage ? 'text-2xl md:text-3xl' : 'text-2xl'} font-bold mb-3 group-hover:text-accent transition-colors leading-tight`}>
            {post.title}
          </h2>
        </Link>
        <p className={`${post.coverImage ? 'text-text-muted' : 'text-text-muted'} text-sm md:text-base line-clamp-3 max-w-2xl`}>
          {post.excerpt}
        </p>
        <div className="mt-4 flex items-center gap-3 text-xs text-text-dim">
          <time className="bg-bg-lighter px-3 py-1 rounded-full">
            {new Date(post.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
          <Link href={`/news/${post.slug}`} className="text-accent hover:underline font-medium">
            Читать дальше →
          </Link>
        </div>
      </div>
    </article>
  );
}
