/** Must match frontend NAV_TOPICS slugs + catch-all. */
export const PRIMARY_RUBRIC_SLUGS = ['ai', 'hardware', 'open-source', 'other'];

/**
 * @param {unknown} v
 * @returns {string}
 */
export function normalizePrimaryRubric(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (PRIMARY_RUBRIC_SLUGS.includes(s)) return s;
  return 'other';
}

/**
 * @param {string[]} tags
 * @returns {string}
 */
export function inferPrimaryRubricFromTags(tags) {
  const slugs = (Array.isArray(tags) ? tags : []).map((t) =>
    String(t || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
  );
  const order = ['ai', 'hardware', 'open-source'];
  for (const r of order) {
    if (slugs.includes(r)) return r;
  }
  if (slugs.some((s) => s === 'openclaw' || s.includes('llm') || s.includes('gpt'))) return 'ai';
  if (slugs.some((s) => s.includes('intel') || s.includes('nvidia') || s.includes('cpu'))) return 'hardware';
  if (slugs.some((s) => s.includes('linux') || s.includes('kernel') || s === 'github')) return 'open-source';
  return 'other';
}
