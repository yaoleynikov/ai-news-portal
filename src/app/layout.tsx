import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI-Insight 2026 | Новости Искусственного Интеллекта',
    template: '%s | AI-Insight 2026',
  },
  description: 'Последние новости из мира ИИ. Аналитика, прогнозы и инсайды о будущем искусственного интеллекта.',
  keywords: ['AI', 'искусственный интеллект', 'машинное обучение', 'нейросети', 'технологии 2026'],
  authors: [{ name: 'AI-Insight Team' }],
  creator: 'AI-Insight 2026',
  publisher: 'AI-Insight 2026',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://ai-insight-2026.vercel.app',
    siteName: 'AI-Insight 2026',
    title: 'AI-Insight 2026 | Новости ИИ',
    description: 'Последние новости из мира ИИ. Аналитика, прогнозы и инсайды.',
  },
  twitter: { card: 'summary_large_image', title: 'AI-Insight 2026', description: 'Последние новости из мира ИИ.' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="canonical" href="https://ai-insight-2026.vercel.app" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'NewsMediaOrganization',
              name: 'AI-Insight 2026',
              url: 'https://ai-insight-2026.vercel.app',
              description: 'SEO-optimized AI news portal',
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-bg antialiased">{children}</body>
    </html>
  );
}
