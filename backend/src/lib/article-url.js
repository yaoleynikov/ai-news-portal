/** Stable article URL for dedup / queue keys (strip hash, common UTM params). */
export function normalizeArticleUrl(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    u.hash = '';
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']) {
      u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return s;
  }
}
