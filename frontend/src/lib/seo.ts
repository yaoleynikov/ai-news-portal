/**
 * SEO and stable URL scheme for SiliconFeed
 *
 * Routes:
 * - /news/[slug]     — articles (Latin, hyphens; stable CMS slug, not id)
 * - /rubric/[slug]   — editorial sections from the nav (ai, hardware, open-source)
 * - /tag/[slug]      — all topic tags, including narrow ones (openclaw, intel, …)
 *
 * Rule: in nav and breadcrumbs, primary topics link to /rubric/; secondary tags use /tag/ only.
 * In article bodies, links use /tag/ as facets.
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

/** Absolute URL for canonical and JSON-LD */
export function absoluteUrl(pathname: string, site: URL | string = SITE_HOST): string {
  const base = typeof site === 'string' ? site : site.origin;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}
