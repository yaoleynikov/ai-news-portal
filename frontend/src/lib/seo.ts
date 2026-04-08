/**
 * SEO и постоянные URL SiliconFeed
 *
 * Схема:
 * - /news/[slug]     — материалы (латиница, дефисы; стабильный slug из CMS, не id)
 * - /rubric/[slug]   — редакционные рубрики из шапки (ai, hardware, open-source)
 * - /tag/[slug]      — все тематические метки, включая узкие (openclaw, intel, …)
 *
 * Правило: в навигации и хлебных крошках для «главных» тем ведём на rubric;
 * вторичные теги — только /tag/. В теле статьи — ссылки на /tag/ (как facet).
 */

export const SITE_HOST = 'https://siliconfeed.online';

export function articlePath(slug: string): string {
  return `/news/${slug}`;
}

export function rubricPath(slug: string): string {
  return `/rubric/${slug}`;
}

export function tagPath(slug: string): string {
  return `/tag/${slug}`;
}

/** Абсолютный URL для каноникала и JSON-LD */
export function absoluteUrl(pathname: string, site: URL | string = SITE_HOST): string {
  const base = typeof site === 'string' ? site : site.origin;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}
