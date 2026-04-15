/**
 * SEO and stable URL scheme for SiliconFeed
 *
 * Routes:
 * - /news/[slug]     — articles (Latin, hyphens; stable CMS slug, not id)
 * - /rubric/[slug]   — editorial sections from the nav (see NAV_TOPICS in lib/tags)
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

/** Absolute URL for remote covers and static assets (pass-through if already `http(s)://`). */
export function absoluteMediaUrl(url: string, site: URL | string = SITE_HOST): string | null {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return absoluteUrl(path, site);
}

/** Origin for same-site checks (Astro `site` from config, else {@link SITE_HOST}). */
export function resolveSiteOrigin(site: URL | undefined): string {
  if (site instanceof URL) return site.origin;
  const base = SITE_HOST.trim().replace(/\/+$/, '') || 'https://siliconfeed.online';
  return new URL(`${base}/`).origin;
}

/**
 * True when `href` points outside this site (http/https or protocol-relative).
 * Root-relative `/…` and `mailto:` / `tel:` are not external.
 */
export function isExternalArticleBodyHref(href: string, siteOrigin: string): boolean {
  const raw = typeof href === 'string' ? href.trim() : '';
  if (!raw || raw.startsWith('#')) return false;
  if (/^(mailto|tel):/i.test(raw)) return false;

  const want = siteOrigin.toLowerCase();
  try {
    if (raw.startsWith('//')) {
      return new URL(`https:${raw}`).origin.toLowerCase() !== want;
    }
    if (raw.startsWith('/')) {
      return false;
    }
    return new URL(raw, `${siteOrigin}/`).origin.toLowerCase() !== want;
  } catch {
    return false;
  }
}

/**
 * Markdown body links only: add nofollow + noopener + noreferrer for **external** targets.
 * Internal links keep their attributes unchanged (does not affect nav/footer elsewhere).
 */
export function mergeMarkdownAnchorRelForContent(
  attribs: Record<string, string>,
  siteOrigin: string
): Record<string, string> {
  if (!isExternalArticleBodyHref(attribs.href ?? '', siteOrigin)) {
    return { ...attribs };
  }
  const out = { ...attribs };
  const parts = new Set(
    String(out.rel ?? '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  for (const r of ['nofollow', 'noopener', 'noreferrer']) {
    parts.add(r);
  }
  out.rel = [...parts].join(' ');
  return out;
}
