/** Strip wrapping quotes and expand \\n (typical .env formatting for PEM). */
export function normalizeGooglePrivateKey(raw) {
  if (raw == null) return '';
  let k = String(raw).trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k.replace(/\\n/g, '\n');
}
