import { absoluteUrl, rubricPath, SITE_HOST } from './seo';
import { NAV_TOPICS } from './tags';

/**
 * URLs passed to `@astrojs/sitemap` `customPages`: SSR routes are not discovered at build time,
 * so we list indexable surfaces explicitly (home, static SSR pages, all rubrics, search).
 * `/privacy` and `/terms` use `prerender: true` and are picked up by the integration automatically.
 */
export function getAstroSitemapCustomPages(): string[] {
  const paths = [
    '/',
    '/about',
    '/search',
    ...NAV_TOPICS.map((t) => rubricPath(t.slug))
  ];
  const urls = paths.map((p) => absoluteUrl(p, SITE_HOST));
  return [...new Set(urls)];
}
