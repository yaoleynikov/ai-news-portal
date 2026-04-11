/**
 * Apex hostnames for Logo.dev — shared by rewriter repair, Telegram admin, article actions.
 * Validates only shape (normalize URL / strip `www.` / sane hostname); no substring blocklists
 * that could reject real brands (e.g. `cnet.com` matched `includes('cnet')`).
 */

/**
 * Admin / DB input → hostname for Logo.dev (`openai.com`). URL and `www.` supported.
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeUserLogoDomain(raw) {
  let s = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).hostname;
    } catch {
      return null;
    }
  } else {
    s = s.split(/[\s/?#]/)[0].trim();
  }
  s = s.replace(/^www\./i, '').toLowerCase();
  if (!s || s.includes('..')) return null;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(s)) return null;
  return s;
}

/**
 * Stored article row → domain for Logo.dev (only rewriter-persisted apex domain).
 * @param {Record<string, unknown>} row
 * @returns {string | null}
 */
export function guessLogoDomainFromRow(row) {
  const kw = typeof row.cover_keyword === 'string' ? row.cover_keyword.trim() : '';
  if (!kw) return null;
  return normalizeUserLogoDomain(kw);
}
