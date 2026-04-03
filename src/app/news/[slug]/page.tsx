import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ArticleContent from '@/components/ArticleContent';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return getAllPostSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Not Found' };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <article className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        <ArticleContent post={post} />
      </article>
      <Footer />
    </div>
  );
}
