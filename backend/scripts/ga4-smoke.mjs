/**
 * GA4 Data API smoke test — loads backend/.env, prints only ok/fail (no secrets).
 * Usage: from backend/: node scripts/ga4-smoke.mjs
 *
 * Requires: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GA4_PROPERTY_ID (numeric).
 * GCP: enable "Google Analytics Data API". GA4: grant the service account Viewer on the property.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { normalizeGooglePrivateKey } from '../src/lib/pem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
const prop = process.env.GA4_PROPERTY_ID?.trim();

if (!email || !keyRaw?.trim()) {
  console.error('FAIL: GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY missing');
  process.exit(1);
}
if (!prop || !/^\d+$/.test(prop)) {
  console.error(
    'FAIL: GA4_PROPERTY_ID missing or not numeric (use Admin → Property settings → Property ID, not G-…)'
  );
  process.exit(1);
}

try {
  const jwt = new google.auth.JWT({
    email,
    key: normalizeGooglePrivateKey(keyRaw),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly']
  });
  await jwt.authorize();

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: jwt });
  const res = await analyticsdata.properties.runReport({
    property: `properties/${prop}`,
    requestBody: {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }]
    }
  });

  const rows = res.data.rows ?? [];
  const totals = res.data.totals?.[0]?.metricValues;
  console.log('OK: Google Analytics Data API (runReport) succeeded.');
  console.log('  property:', `properties/${prop}`);
  console.log('  rows returned:', rows.length);
  if (totals?.length) {
    console.log(
      '  totals (7d):',
      `activeUsers=${totals[0]?.value ?? '?'}`,
      `sessions=${totals[1]?.value ?? '?'}`
    );
  } else if (rows[0]?.metricValues) {
    const m = rows[0].metricValues;
    console.log(
      '  first row:',
      `activeUsers=${m[0]?.value ?? '?'}`,
      `sessions=${m[1]?.value ?? '?'}`
    );
  } else {
    console.log('  (no metric rows — property may have no traffic in range, but API is fine)');
  }
  process.exit(0);
} catch (e) {
  const err = e?.response?.data?.error || e?.errors?.[0] || e;
  const msg =
    err?.message ||
    (typeof err === 'object' ? JSON.stringify(err).slice(0, 400) : String(err));
  console.error('FAIL: GA4 Data API:', msg);
  process.exit(1);
}
