import { config } from '../config.js';

/**
 * Same clip as `rewriteArticle` / worker before the model sees the source.
 * @param {string} text
 */
export function clipSourceForRewriter(text) {
  const body = typeof text === 'string' ? text : '';
  const maxIn = config.limits.maxChars;
  return body.length > maxIn ? body.substring(0, maxIn) : body;
}

/**
 * True if published body is suspiciously short vs stored source extract.
 * @param {string | null | undefined} sourceExtract
 * @param {string | null | undefined} contentMd
 * @param {{ ratio?: number; minSourceChars?: number }} [opts]
 */
export function isRewriteTooShortVsSource(sourceExtract, contentMd, opts = {}) {
  const ratio = typeof opts.ratio === 'number' && opts.ratio > 0 && opts.ratio <= 1 ? opts.ratio : 0.5;
  const minSourceChars =
    typeof opts.minSourceChars === 'number' && opts.minSourceChars > 0
      ? opts.minSourceChars
      : 800;
  const src = typeof sourceExtract === 'string' ? sourceExtract.trim() : '';
  const md = typeof contentMd === 'string' ? contentMd.trim() : '';
  if (src.length < minSourceChars) return false;
  if (md.length < 1) return true;
  return md.length < src.length * ratio;
}

export function rewriteLengthMinRatio() {
  const n = parseFloat(process.env.REWRITE_LENGTH_MIN_RATIO || '');
  if (Number.isFinite(n) && n > 0 && n <= 1) return n;
  return 0.5;
}

export function rewriteLengthMinSourceChars() {
  const n = parseInt(process.env.REWRITE_LENGTH_MIN_SOURCE_CHARS || '', 10);
  if (Number.isFinite(n) && n >= 200) return Math.min(n, 50000);
  return 800;
}

export function rewriteRefreshMaxPerCycle() {
  const n = parseInt(process.env.REWRITE_REFRESH_MAX_PER_CYCLE || '', 10);
  if (Number.isFinite(n) && n >= 0) return Math.min(n, 50);
  return 3;
}
