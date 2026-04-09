import { DateTime } from 'luxon';
import { supabase, config } from '../config.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { normalizeGooglePrivateKey } from '../lib/pem.js';

function envTruthy(v) {
  if (v === undefined || v === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @returns {{ startIso: string, endExclusiveIso: string, ymd: string }} */
export function reportDayBounds(reportDateYmd, timeZone) {
  const start = DateTime.fromISO(`${reportDateYmd}T00:00:00`, { zone: timeZone });
  if (!start.isValid) {
    throw new Error(`Invalid report date: ${reportDateYmd}`);
  }
  const endEx = start.plus({ days: 1 });
  return {
    ymd: reportDateYmd,
    startIso: start.toUTC().toISO(),
    endExclusiveIso: endEx.toUTC().toISO()
  };
}

/** “Today” in the configured timezone (wall clock). */
export function todayYmdInZone(timeZone) {
  return DateTime.now().setZone(timeZone).toFormat('yyyy-MM-dd');
}

async function getGoogleReportingAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !keyRaw?.trim()) return null;
  const { google } = await import('googleapis');
  const jwt = new google.auth.JWT({
    email,
    key: normalizeGooglePrivateKey(keyRaw),
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly'
    ]
  });
  await jwt.authorize();
  return jwt;
}

function gscSiteUrl() {
  const explicit = process.env.GSC_SITE_URL?.trim();
  if (explicit) return explicit;
  const base = config.publicSiteUrl.replace(/\/$/, '');
  return `${base}/`;
}

/**
 * @param {import('google-auth-library').JWT} auth
 * @param {string} ymd
 */
async function fetchSearchTotals(auth, siteUrl, ymd) {
  const { google } = await import('googleapis');
  const webmasters = google.webmasters({ version: 'v3', auth });
  const body = {
    startDate: ymd,
    endDate: ymd,
    type: 'web',
    rowLimit: 1
  };
  let res;
  try {
    res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: { ...body, dataState: 'all' }
    });
  } catch {
    res = await webmasters.searchanalytics.query({ siteUrl, requestBody: body });
  }
  const row = res.data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0
  };
}

/**
 * Distinct /news/… URLs that had ≥1 impression that day (proxy for “visible in Search”).
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchNewsPageRows(auth, siteUrl, ymd) {
  const { google } = await import('googleapis');
  const webmasters = google.webmasters({ version: 'v3', auth });
  const newsBody = {
    startDate: ymd,
    endDate: ymd,
    type: 'web',
    dimensions: ['page'],
    dimensionFilterGroups: [
      {
        groupType: 'and',
        filters: [
          {
            dimension: 'page',
            operator: 'includingRegex',
            expression: '.*/news/.+'
          }
        ]
      }
    ],
    rowLimit: 25000
  };
  let res;
  try {
    res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: { ...newsBody, dataState: 'all' }
    });
  } catch {
    res = await webmasters.searchanalytics.query({ siteUrl, requestBody: newsBody });
  }
  const rows = res.data.rows || [];
  const withImp = rows.filter((r) => (r.impressions ?? 0) > 0);
  return { count: withImp.length, rows: withImp };
}

/**
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGa4Day(auth, propertyNumericId, ymd) {
  const { google } = await import('googleapis');
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const name = String(propertyNumericId).trim();
  const res = await analyticsdata.properties.runReport({
    property: `properties/${name}`,
    requestBody: {
      dateRanges: [{ startDate: ymd, endDate: ymd }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }]
    }
  });
  const row = res.data.rows?.[0];
  const vals = row?.metricValues || [];
  return {
    activeUsers: vals[0]?.value ?? '0',
    sessions: vals[1]?.value ?? '0',
    screenPageViews: vals[2]?.value ?? '0'
  };
}

/**
 * @param {import('google-auth-library').JWT} auth
 * @param {string} inspectionUrl
 * @param {string} siteUrl
 */
async function inspectOneUrl(auth, inspectionUrl, siteUrl) {
  const { google } = await import('googleapis');
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const api = searchconsole.urlInspection.index;
  if (!api?.inspect) {
    return { ok: false, error: 'urlInspection.index.inspect not available in googleapis client' };
  }
  const { data } = await api.inspect({
    requestBody: {
      inspectionUrl,
      siteUrl,
      languageCode: 'en-US'
    }
  });
  const verdict = data?.inspectionResult?.indexStatusResult?.verdict;
  const coverage = data?.inspectionResult?.indexStatusResult?.coverageState;
  return { ok: true, verdict, coverage };
}

async function fetchArticlesForDay(startIso, endExclusiveIso) {
  const { data, error } = await supabase
    .from('articles')
    .select('title, slug, created_at')
    .eq('status', 'published')
    .gte('created_at', startIso)
    .lt('created_at', endExclusiveIso)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`articles query: ${error.message}`);
  }
  return data || [];
}

function buildMessage({
  reportDateYmd,
  timeZone,
  articles,
  gscTotals,
  gscNews,
  ga4,
  inspections,
  gscError,
  gaError,
  inspectError
}) {
  const lines = [];
  lines.push(`📊 <b>SiliconFeed</b> — ${escHtml(reportDateYmd)} (${escHtml(timeZone)})`);
  lines.push('');
  lines.push(`<b>Новые статьи</b> (созданы за день): ${articles.length}`);
  const maxList = 15;
  for (let i = 0; i < Math.min(articles.length, maxList); i++) {
    const a = articles[i];
    const u = `${config.publicSiteUrl}/news/${a.slug}`;
    lines.push(`• ${escHtml(a.title)} — <a href="${escHtml(u)}">${escHtml(a.slug)}</a>`);
  }
  if (articles.length > maxList) {
    lines.push(`… и ещё ${articles.length - maxList}`);
  }

  lines.push('');
  lines.push('<b>Google Поиск</b> (Search Console, веб-поиск)');
  if (gscError) {
    lines.push(`<i>нет данных:</i> ${escHtml(gscError)}`);
  } else if (gscTotals) {
    lines.push(`Клики: <b>${gscTotals.clicks}</b>`);
    lines.push(`Показы: <b>${gscTotals.impressions}</b>`);
    lines.push(`Средняя позиция: ${gscTotals.position ? gscTotals.position.toFixed(1) : '—'}`);
    lines.push(
      `Страниц <code>/news/…</code> с показами в этот день: <b>${gscNews?.count ?? 0}</b> <i>(показ в выдаче ≠ гарантия индекса)</i>`
    );
  }

  if (inspections?.length) {
    lines.push('');
    lines.push('<b>URL Inspection</b> (новые статьи дня, выборочно)');
    for (const row of inspections) {
      lines.push(
        `• ${escHtml(row.slug)}: ${escHtml(row.coverage || row.verdict || row.error || '—')}`
      );
    }
  } else if (inspectError) {
    lines.push('');
    lines.push(`<b>URL Inspection:</b> <i>${escHtml(inspectError)}</i>`);
  }

  lines.push('');
  lines.push('<b>Посетители</b> (GA4, календарный день свойства)');
  if (gaError) {
    lines.push(`<i>нет данных:</i> ${escHtml(gaError)}`);
  } else if (ga4) {
    lines.push(`Активные пользователи: <b>${escHtml(ga4.activeUsers)}</b>`);
    lines.push(`Сессии: ${escHtml(ga4.sessions)}`);
    lines.push(`Просмотры: ${escHtml(ga4.screenPageViews)}`);
  }

  lines.push('');
  lines.push(
    '<i>Данные Поиска/GA4 могут догонять с задержкой; итоговые цифры часто стабильнее на следующий день. Даты в Search Console API считаются по правилам Google (часто тихоокеанский календарный день для поля date — см. документацию GSC).</i>'
  );

  return lines.join('\n');
}

async function sendChunkedHtml(token, chatId, html) {
  const max = 3900;
  for (let i = 0; i < html.length; i += max) {
    const chunk = html.slice(i, i + max);
    const ok = await sendTelegramMessage(token, chatId, chunk, { parseMode: 'HTML' });
    if (!ok) return false;
  }
  return true;
}

/**
 * @param {{ reportDate?: string, timeZone?: string }} [opts]
 */
export async function runDailyStatsReport(opts = {}) {
  const timeZone = opts.timeZone || process.env.STATS_REPORT_TIMEZONE || 'Europe/Moscow';
  const reportDateYmd = opts.reportDate || todayYmdInZone(timeZone);

  const token = process.env.TG_BOT_TOKEN?.trim();
  const chatId = process.env.TG_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn('[stats] TG_BOT_TOKEN / TG_ADMIN_CHAT_ID missing — skip daily report.');
    return;
  }

  const { startIso, endExclusiveIso } = reportDayBounds(reportDateYmd, timeZone);
  const articles = await fetchArticlesForDay(startIso, endExclusiveIso);

  let gscTotals = null;
  let gscNews = null;
  let gscError = null;
  let ga4 = null;
  let gaError = null;
  let inspections = [];
  let inspectError = null;

  const auth = await getGoogleReportingAuth().catch((e) => null);
  const siteUrl = gscSiteUrl();

  if (!auth) {
    gscError = 'нет JWT (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY) или ошибка авторизации';
    gaError = gscError;
  } else {
    try {
      gscTotals = await fetchSearchTotals(auth, siteUrl, reportDateYmd);
      gscNews = await fetchNewsPageRows(auth, siteUrl, reportDateYmd);
    } catch (e) {
      gscError = e?.message || String(e);
    }

    const gaProp = process.env.GA4_PROPERTY_ID?.trim();
    if (!gaProp) {
      gaError = 'GA4_PROPERTY_ID не задан (числовой ID ресурса в GA4, не G-…)';
    } else {
      try {
        ga4 = await fetchGa4Day(auth, gaProp, reportDateYmd);
      } catch (e) {
        gaError = e?.message || String(e);
      }
    }

    if (envTruthy(process.env.STATS_URL_INSPECT)) {
      const max = Math.min(
        10,
        Math.max(0, Number(process.env.STATS_INSPECTION_MAX || '5') || 5)
      );
      const siteForInspect = siteUrl;
      try {
        for (let i = 0; i < Math.min(articles.length, max); i++) {
          const a = articles[i];
          const url = `${config.publicSiteUrl}/news/${a.slug}`;
          const r = await inspectOneUrl(auth, url, siteForInspect);
          if (r.ok) {
            inspections.push({ slug: a.slug, verdict: r.verdict, coverage: r.coverage });
          } else {
            inspections.push({ slug: a.slug, error: r.error });
          }
          await new Promise((res) => setTimeout(res, 350));
        }
      } catch (e) {
        inspectError = e?.message || String(e);
      }
    }
  }

  const html = buildMessage({
    reportDateYmd,
    timeZone,
    articles,
    gscTotals,
    gscNews,
    ga4,
    inspections,
    gscError,
    gaError,
    inspectError
  });

  console.log(`[stats] Sending daily report for ${reportDateYmd} (${timeZone})`);
  await sendChunkedHtml(token, chatId, html);
}

let lastFiredYmd = null;

/**
 * Fires once per calendar day in `timeZone` when wall clock is in [hour:minute, hour:minute+window).
 */
export function startDailyStatsScheduler() {
  if (!envTruthy(process.env.STATS_DAILY_REPORT)) {
    console.log('[stats] Daily Telegram report off (set STATS_DAILY_REPORT=1 to enable).');
    return;
  }

  const timeZone = process.env.STATS_REPORT_TIMEZONE || 'Europe/Moscow';
  const hour = Number(process.env.STATS_REPORT_HOUR ?? '21');
  const minute = Number(process.env.STATS_REPORT_MINUTE ?? '0');
  const windowMin = Math.min(15, Math.max(1, Number(process.env.STATS_FIRE_WINDOW_MIN ?? '3') || 3));

  console.log(
    `[stats] Daily report scheduled ~${hour}:${String(minute).padStart(2, '0')} ${timeZone} (window ${windowMin} min)`
  );

  const tick = () => {
    const now = DateTime.now().setZone(timeZone);
    const ymd = now.toFormat('yyyy-MM-dd');
    const curM = now.hour * 60 + now.minute;
    const startM = hour * 60 + minute;
    const ok = curM >= startM && curM < startM + windowMin;

    if (!ok) return;
    if (lastFiredYmd === ymd) return;
    lastFiredYmd = ymd;

    runDailyStatsReport({ timeZone }).catch((e) =>
      console.error('[stats] Daily report failed:', e?.message || e)
    );
  };

  setInterval(tick, 45_000);
  setTimeout(tick, 15_000);
}
