import { normalizeGooglePrivateKey } from './pem.js';

export function isGoogleIndexingConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim()
  );
}

/**
 * Google Indexing API v3 — notifies Google that a URL was created or updated.
 * Prerequisites (all in Google Cloud + Search Console):
 * 1) Enable **Indexing API** for your GCP project.
 * 2) Create a **service account**, download JSON; put `client_email` → GOOGLE_SERVICE_ACCOUNT_EMAIL, `private_key` → GOOGLE_PRIVATE_KEY in .env (PEM newlines as \\n).
 * 3) In **Search Console** → site property for this host → **Settings → Users and permissions** → Add the service account email as **Owner** (required for this API).
 *
 * @param {string} absoluteUrl Full https URL (e.g. https://siliconfeed.online/news/my-slug)
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function notifyGoogleUrlUpdated(absoluteUrl) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !keyRaw?.trim()) {
    return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY missing' };
  }
  const u = String(absoluteUrl || '').trim();
  if (!/^https:\/\//i.test(u)) {
    return { ok: false, error: 'URL must be absolute https' };
  }

  try {
    const { google } = await import('googleapis');
    const jwtClient = new google.auth.JWT({
      email,
      key: normalizeGooglePrivateKey(keyRaw),
      scopes: ['https://www.googleapis.com/auth/indexing']
    });
    await jwtClient.authorize();
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });
    await indexing.urlNotifications.publish({
      requestBody: {
        url: u,
        type: 'URL_UPDATED'
      }
    });
    return { ok: true };
  } catch (e) {
    const api = e?.response?.data?.error;
    const msg =
      (typeof api === 'object' && api?.message) ||
      (Array.isArray(api?.errors) && api.errors[0]?.message) ||
      e?.message ||
      String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Google Indexing API v3 — сообщить, что URL удалён (контент больше не должен быть в индексе).
 * Те же требования, что у {@link notifyGoogleUrlUpdated} (Search Console + сервисный аккаунт Owner).
 *
 * Имеет смысл для **осознанного** снятия страницы с публикации: ускоряет выброс из индекса по сравнению
 * с ожиданием краулера. Не заменяет нормальный HTTP 404/410 на сайте — их всё равно должен отдавать фронт.
 *
 * @param {string} absoluteUrl
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function notifyGoogleUrlDeleted(absoluteUrl) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !keyRaw?.trim()) {
    return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY missing' };
  }
  const u = String(absoluteUrl || '').trim();
  if (!/^https:\/\//i.test(u)) {
    return { ok: false, error: 'URL must be absolute https' };
  }

  try {
    const { google } = await import('googleapis');
    const jwtClient = new google.auth.JWT({
      email,
      key: normalizeGooglePrivateKey(keyRaw),
      scopes: ['https://www.googleapis.com/auth/indexing']
    });
    await jwtClient.authorize();
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });
    await indexing.urlNotifications.publish({
      requestBody: {
        url: u,
        type: 'URL_DELETED'
      }
    });
    return { ok: true };
  } catch (e) {
    const api = e?.response?.data?.error;
    const msg =
      (typeof api === 'object' && api?.message) ||
      (Array.isArray(api?.errors) && api.errors[0]?.message) ||
      e?.message ||
      String(e);
    return { ok: false, error: msg };
  }
}
