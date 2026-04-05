import { getPostBySlug, getAllPostSlugs, getSortedPosts } from '@/lib/posts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import RelatedArticles from '@/components/RelatedArticles';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';

export async function generateStaticParams() { return getAllPostSlugs().map(slug => ({ slug })); }

const COVER_V = 'v5';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const post = getPostBySlug(slug);
  if (!post) return { title: 'Not Found' };
  const coverUrl = `/covers/${slug}.jpg?v=${COVER_V}`;
  return {
    title: post.title,
    description: post.excerpt,
    robots: {
      other: ['max-image-preview:large'],
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://siliconfeed.online/news/${slug}`,
      siteName: 'SiliconFeed',
      type: 'article',
      locale: 'en_US',
      images: [
        {
          url: coverUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.date,
      modifiedTime: post.date,
      authors: [post.author || 'SiliconFeed Editorial Team'],
      tags: post.tags || [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [coverUrl],
    },
    alternates: {
      canonical: `https://siliconfeed.online/news/${slug}`,
    },
  };
}

function buildJsonLd(post: any) {
  const url = `https://siliconfeed.online/news/${post.slug}`;
  const coverUrl = `https://siliconfeed.online/covers/${post.slug}.jpg?v=${COVER_V}`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    headline: post.title,
    description: post.excerpt,
    image: {
      '@type': 'ImageObject',
      url: coverUrl,
      width: 1200,
      height: 630,
    },
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: 'SiliconFeed Editorial Team',
      url: 'https://siliconfeed.online/about',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SiliconFeed',
      logo: {
        '@type': 'ImageObject',
        url: 'https://siliconfeed.online/logo.png',
      },
    },
    keywords: (post.tags || []).join(', '),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://siliconfeed.online/' },
      { '@type': 'ListItem', position: 2, name: 'News', item: 'https://siliconfeed.online/news' },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  };
  const faqItems = post.faqData?.map((item: { q: string; a: string }, i: number) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })) || [];
  const jsonLd = [];
  jsonLd.push(article);
  jsonLd.push(breadcrumb);
  if (faqItems.length > 0) {
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems });
  }
  return jsonLd;
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const words = Math.max(1, Math.ceil((post.rawContent || '').length / 5));
  const mins = Math.ceil(words / 200);

  // Parse Monster Take
  let mtText = '';
  if (post.rawContent) {
    const fmEnd = post.rawContent.indexOf('---', 3);
    if (fmEnd > -1) {
      const body = post.rawContent.substring(fmEnd + 3);
      const mtM = body.match(/## Monster Take\s*([\s\S]+)/);
      if (mtM) mtText = mtM[1].replace(/^[\n\r]+/, '').replace(/^> /gm, '').trim();
    }
  }

  const cleanHtml = post.contentHtml.replace(/<h2[^>]*>\s*Monster Take\s*<\/h2>[\s\S]*$/, '');
  const coverUrl = `/covers/${slug}.jpg?v=${COVER_V}`;

  return (
    <div>
      <Header />
      <article className="art">
        <h1>{post.title}</h1>
        <p className="a-sub">{post.excerpt}</p>
        <div className="a-bar">
          <span>{post.tags?.[0] || 'news'}</span>
          <span style={{ color: 'var(--text-d)' }}>·</span>
          <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
          <span style={{ color: 'var(--text-d)' }}>·</span>
          <span>{mins} min read</span>
        </div>

        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'News', href: '/news' }]} />

        {/* Cover image */}
        <figure className="a-img">
          <img src={coverUrl} alt={post.coverAlt || post.title} width="1200" height="630" loading="eager" />
        </figure>

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(post)) }}
        />

        {/* YouTube video embed below cover */}
        {post.youtubeId && (
          <iframe
            width="100%"
            height="380"
            src={`https://www.youtube.com/embed/${post.youtubeId}?rel=0`}
            title="YouTube video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: 'var(--r-2)', marginBottom: 'var(--sp-2)', border: 'none' }}
          />
        )}

        <div className="rich" dangerouslySetInnerHTML={{ __html: cleanHtml }} />

        {mtText && (
          <div className="mt">
            <p className="mt-l">SiliconFeed Take</p>
            <p>{mtText}</p>
          </div>
        )}
      </article>

      {/* Related Articles */}
      <RelatedArticles currentSlug={post.slug} tags={post.tags || []} date={post.date} limit={4} />

      <Footer />
    </div>
  );
}

