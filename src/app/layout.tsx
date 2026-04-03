import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SiliconFeed — Silicon Valley & Tech News', template: '%s | SiliconFeed' },
  description: 'Autonomous tech news aggregator: AI, startups, cloud, cybersecurity, apps, crypto.',
  keywords: ['Silicon Valley', 'tech news', 'startups', 'AI', 'artificial intelligence', 'cloud computing', 'cybersecurity', 'SaaS'],
  authors: [{ name: 'SiliconFeed Team' }],
  creator: 'SiliconFeed',
  publisher: 'SiliconFeed',
  metadataBase: new URL('https://siliconfeed.online'),
  alternates: { canonical: 'https://siliconfeed.online' },
  openGraph: {
    type: 'website', locale: 'en_US', url: 'https://siliconfeed.online',
    siteName: 'SiliconFeed', title: 'SiliconFeed — Silicon Valley & Tech News',
    description: 'Autonomous tech news aggregator: AI, startups, cloud, cybersecurity, apps.',
  },
  twitter: { card: 'summary_large_image', title: 'SiliconFeed', description: 'Silicon Valley & tech news.' },
  robots: { index: true, follow: true },
  verification: {
    google: 'add-your-google-site-verification-code-here',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://siliconfeed.online" />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔥</text></svg>" />
        <meta name="theme-color" content="#1c1917" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org', '@type': 'NewsMediaOrganization',
            name: 'SiliconFeed', url: 'https://siliconfeed.online',
            logo: { '@type': 'ImageObject', url: 'https://siliconfeed.online/logo.png' }, sameAs: [],
          }),
        }} />
      </head>
      <body className="antialiased">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-0456HS5LSV" strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-0456HS5LSV');`,
        }} />
        {children}
      </body>
    </html>
  );
}
