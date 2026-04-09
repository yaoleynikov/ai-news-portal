/**
 * Manually notify Google Indexing API about a URL (same as worker after publish).
 *
 * Usage:
 *   node scripts/ping-indexing.mjs https://siliconfeed.online/news/your-slug
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.argv[2]?.trim();
if (!url || !/^https:\/\//i.test(url)) {
  console.error('Usage: node scripts/ping-indexing.mjs https://your-domain/news/slug');
  process.exit(1);
}

const { notifyGoogleUrlUpdated, isGoogleIndexingConfigured } = await import('../src/lib/google-indexing.js');

if (!isGoogleIndexingConfigured()) {
  console.error('Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in backend/.env');
  process.exit(1);
}

const out = await notifyGoogleUrlUpdated(url);
if (out.ok) {
  console.log('OK: Google Indexing API accepted URL_UPDATED for', url);
  process.exit(0);
}
console.error('FAIL:', out.error);
process.exit(1);
