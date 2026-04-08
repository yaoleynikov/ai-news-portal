/** Lazy-load sharp; Node 22 + Windows can fail native bind (ERR_DLOPEN_FAILED). */
let cached = undefined;

/**
 * @returns {Promise<import('sharp') | null>}
 */
export async function loadSharp() {
  if (cached !== undefined) return cached;
  try {
    const mod = await import('sharp');
    const sharp = mod.default;
    sharp.concurrency(1);
    cached = sharp;
    return sharp;
  } catch (e) {
    console.warn('[MEDIA] sharp native module unavailable, covers will be PNG passthrough:', e.message);
    cached = null;
    return null;
  }
}
