import { randomBytes } from 'node:crypto';

/** Known glued segments the model sometimes emits (e.g. news + samsung). */
const SLUG_SEGMENT_FIXES = new Map([['newssamsung', 'news-samsung']]);

/**
 * @param {string} slug
 */
function repairSlugSegments(slug) {
  return slug
    .split('-')
    .map((seg) => SLUG_SEGMENT_FIXES.get(seg.toLowerCase()) ?? seg)
    .join('-');
}

/**
 * Latin kebab-case slug for URLs. Model may suggest `slug`; we validate and fall back if needed.
 * @param {unknown} modelSlug
 * @param {string} title
 */
export function finalizeArticleSlug(modelSlug, title) {
  let s = typeof modelSlug === 'string' ? modelSlug.trim().toLowerCase() : '';
  s = s.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  s = repairSlugSegments(s);
  if (s.length >= 3 && s.length <= 96) return s.slice(0, 80);

  const latin = String(title || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const base = latin.length >= 3 ? latin : 'article';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/**
 * Insert article with slug collision retries (unique index on slug).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} row must include `slug`
 */
export async function insertPublishedArticleRow(client, row, { maxAttempts = 6 } = {}) {
  const baseSlug = String(row.slug || '').trim() || 'article';
  let slug = baseSlug;
  let lastErr;

  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await client.from('articles').insert({ ...row, slug }).select('id').limit(1);

    if (!error && data?.length) {
      return { id: data[0].id, slug };
    }

    lastErr = error;
    const code = error?.code;
    const msg = (error?.message || '').toLowerCase();
    if (code === '23505' && (msg.includes('slug') || msg.includes('articles_slug'))) {
      slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
      continue;
    }
    throw new Error(error?.message || 'articles insert failed');
  }

  throw new Error(lastErr?.message || 'articles insert: slug retries exhausted');
}
