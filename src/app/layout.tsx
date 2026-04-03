import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SiliconFeed — Silicon Valley & IT News Feed',
    template: '%s | SiliconFeed',
  },
  description: 'Silicon Valley, AI, startups, cloud, cybersecurity, apps. Autonomous tech news aggregator.',
  keywords: ['Silicon Valley', 'tech news', 'startups', 'artificial intelligence', 'cloud computing', 'cybersecurity', 'SaaS', 'mobile apps'],
  authors: [{ name: 'SiliconFeed Team' }],
  creator: 'SiliconFeed',
  publisher: 'SiliconFeed',
  metadataBase: new URL('https://siliconfeed.online'),
  alternates: { canonical: 'https://siliconfeed.online' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://siliconfeed.online',
    siteName: 'SiliconFeed',
    title: 'SiliconFeed — Silicon Valley & IT News',
    description: 'Autonomous tech news aggregator: AI, startups, cloud, apps, cybersecurity.',
  },
  twitter: { card: 'summary_large_image', title: 'SiliconFeed', description: 'Silicon Valley & IT news feed.' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://siliconfeed.online" />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔥</text></svg>" />
        <meta name="theme-color" content="#0a0a0b" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'NewsMediaOrganization',
              name: 'SiliconFeed',
              url: 'https://siliconfeed.online',
              logo: { '@type': 'ImageObject', url: 'https://siliconfeed.online/logo.png' },
              sameAs: [],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-bg antialiased">{children}</body>
    </html>
  );
}
