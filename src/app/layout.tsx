import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'siliconfeed — tech intelligence', template: '%s // siliconfeed' },
  description: 'Autonomous tech news aggregator: AI, startups, cloud, security, crypto.',
  metadataBase: new URL('https://siliconfeed.online'),
  alternates: { canonical: 'https://siliconfeed.online' },
  openGraph: { type: 'website', locale: 'en_US', url: 'https://siliconfeed.online', siteName: 'siliconfeed' },
  twitter: { card: 'summary_large_image', title: 'siliconfeed' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://siliconfeed.online" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23111' width='100' height='100'/><text y='.9em' x='8' font-family='monospace' font-size='72' fill='white' font-weight='bold'>sf</text></svg>" />
      </head>
      <body>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-0456HS5LSV" strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-0456HS5LSV');` }} />
        {children}
      </body>
    </html>
  );
}
