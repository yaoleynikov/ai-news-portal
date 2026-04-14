import { config } from '../config.js';

/**
 * Text used for semantic dedup embedding (pre-rewrite). Longer slice = stabler near-duplicate detection.
 * @param {{ title: string, textContent: string }} extracted
 */
export function buildDedupEmbedInput(extracted) {
  const title = String(extracted?.title || '').trim();
  const body = String(extracted?.textContent || '');
  const max = config.limits.dedupEmbedMaxChars;
  return `${title}\n\n${body.slice(0, max)}`;
}

/** @returns {Promise<'ok'|'duplicate'|'rpc_error'>} */
export async function checkSemanticDuplicate(supabase, embedding) {
  try {
    const { data, error } = await supabase.rpc('match_articles', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: config.limits.similarityThreshold,
      match_count: 1
    });

    if (error) {
      console.warn('[DEDUP] match_articles RPC failed:', error.message);
      return 'rpc_error';
    }

    if (data && data.length > 0) return 'duplicate';
    return 'ok';
  } catch (e) {
    console.warn('[DEDUP] match_articles exception:', e.message);
    return 'rpc_error';
  }
}

/**
 * Same headline (alphanumeric fingerprint) as a recent published piece — catches syndication with different URLs.
 * @returns {Promise<'ok'|'duplicate'|'rpc_error'>}
 */
export async function checkTitleFingerprintDuplicate(supabase, rawTitle) {
  try {
    const { data, error } = await supabase.rpc('match_article_title_fingerprint', {
      p_title: rawTitle,
      p_since_hours: config.limits.dedupTitleLookbackHours
    });

    if (error) {
      console.warn('[DEDUP] match_article_title_fingerprint RPC failed:', error.message);
      return 'rpc_error';
    }

    if (data && data.length > 0) return 'duplicate';
    return 'ok';
  } catch (e) {
    console.warn('[DEDUP] match_article_title_fingerprint exception:', e.message);
    return 'rpc_error';
  }
}
