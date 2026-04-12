import type { MiddlewareHandler } from 'astro';

/** Same host as `site` in astro.config.mjs — avoids www HTML + apex /_astro (CORS on ES modules). */
const CANONICAL_ORIGIN = 'https://siliconfeed.online';

export const onRequest: MiddlewareHandler = (context, next) => {
  if (context.url.hostname === 'www.siliconfeed.online') {
    const dest = new URL(context.url.pathname + context.url.search, CANONICAL_ORIGIN);
    return Response.redirect(dest, 308);
  }
  return next();
};
