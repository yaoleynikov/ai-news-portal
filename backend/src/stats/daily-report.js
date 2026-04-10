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
 * Top search queries for the day (by clicks).
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGscTopQueries(auth, siteUrl, ymd, limit = 8) {
  const { google } = await import('googleapis');
  const webmasters = google.webmasters({ version: 'v3', auth });
  const body = {
    startDate: ymd,
    endDate: ymd,
    type: 'web',
    dimensions: ['query'],
    rowLimit: 40
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
  const rows = res.data.rows || [];
  rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
  return rows.slice(0, limit).map((r) => ({
    query: (r.keys && r.keys[0]) || '',
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position
  }));
}

function mapMetricRow(res) {
  const names = (res.data.metricHeaders || []).map((h) => h.name);
  const vals = res.data.rows?.[0]?.metricValues || [];
  const out = {};
  names.forEach((n, i) => {
    out[n] = vals[i]?.value ?? '0';
  });
  return out;
}

function formatDurationSeconds(val) {
  const s = parseFloat(String(val).replace(',', '.'));
  if (!Number.isFinite(s) || s < 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

function formatRate(val) {
  const x = parseFloat(String(val).replace(',', '.'));
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(1)}%`;
}

/**
 * GA4 overview metrics (single day, no dimensions).
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGa4Overview(auth, propertyNumericId, ymd) {
  const { google } = await import('googleapis');
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${String(propertyNumericId).trim()}`;
  const metrics = [
    { name: 'activeUsers' },
    { name: 'newUsers' },
    { name: 'sessions' },
    { name: 'screenPageViews' },
    { name: 'averageSessionDuration' },
    { name: 'engagementRate' },
    { name: 'eventCount' }
  ];
  const body = {
    dateRanges: [{ startDate: ymd, endDate: ymd }],
    metrics
  };
  try {
    const res = await analyticsdata.properties.runReport({ property, requestBody: body });
    return mapMetricRow(res);
  } catch {
    const res = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: ymd, endDate: ymd }],
        metrics: metrics.slice(0, 5)
      }
    });
    return mapMetricRow(res);
  }
}

/**
 * Sessions by default channel group (Organic Search, Direct, …).
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGa4ChannelBreakdown(auth, propertyNumericId, ymd, limit = 6) {
  const { google } = await import('googleapis');
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${String(propertyNumericId).trim()}`;
  const res = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: ymd, endDate: ymd }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit
    }
  });
  const rows = res.data.rows || [];
  return rows.map((row) => ({
    channel: row.dimensionValues?.[0]?.value ?? '—',
    sessions: row.metricValues?.[0]?.value ?? '0',
    users: row.metricValues?.[1]?.value ?? '0'
  }));
}

/**
 * Top page paths by views (site-wide).
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGa4TopPaths(auth, propertyNumericId, ymd, limit = 8) {
  const { google } = await import('googleapis');
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${String(propertyNumericId).trim()}`;
  const res = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: ymd, endDate: ymd }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit
    }
  });
  const rows = res.data.rows || [];
  return rows.map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '—',
    views: row.metricValues?.[0]?.value ?? '0',
    users: row.metricValues?.[1]?.value ?? '0'
  }));
}

/**
 * Top /news/… paths only.
 * @param {import('google-auth-library').JWT} auth
 */
async function fetchGa4TopNewsPaths(auth, propertyNumericId, ymd, limit = 6) {
  const { google } = await import('googleapis');
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${String(propertyNumericId).trim()}`;
  const res = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: ymd, endDate: ymd }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: { matchType: 'CONTAINS', value: '/news/' }
        }
      },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit
    }
  });
  const rows = res.data.rows || [];
  return rows.map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '—',
    views: row.metricValues?.[0]?.value ?? '0'
  }));
}

async function fetchPendingJobsCount() {
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return null;
  return typeof count === 'number' ? count : 0;
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
  pendingJobs,
  gscTotals,
  gscNews,
  gscQueries,
  ga4,
  inspections,
  gscError,
  gaError,
  inspectError
}) {
  const lines = [];
  lines.push(`📊 <b>SiliconFeed</b> — ${escHtml(reportDateYmd)} (${escHtml(timeZone)})`);
  lines.push('');
  if (pendingJobs != null) {
    lines.push(`<b>Очередь</b> (jobs pending): <b>${pendingJobs}</b>`);
    lines.push('');
  }

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
    lines.push(`CTR (сводно): ${gscTotals.ctr ? (gscTotals.ctr * 100).toFixed(2) + '%' : '—'}`);
    lines.push(`Средняя позиция: ${gscTotals.position ? gscTotals.position.toFixed(1) : '—'}`);
    lines.push(
      `Страниц <code>/news/…</code> с показами в этот день: <b>${gscNews?.count ?? 0}</b> <i>(показ в выдаче ≠ гарантия индекса)</i>`
    );
    if (gscQueries?.length) {
      lines.push('');
      lines.push('<b>Топ запросов</b> (клики):');
      for (const q of gscQueries) {
        if (!q.query) continue;
        const pos = q.position != null ? q.position.toFixed(1) : '—';
        lines.push(
          `• ${escHtml(q.query.slice(0, 80))}${q.query.length > 80 ? '…' : ''} — <b>${q.clicks}</b> clk, ${q.impressions} imp, pos ~${pos}`
        );
      }
    }
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
  const hasGa =
    ga4?.overview ||
    (ga4?.channels?.length ?? 0) > 0 ||
    (ga4?.topPaths?.length ?? 0) > 0 ||
    (ga4?.topNews?.length ?? 0) > 0;
  if (gaError && !hasGa) {
    lines.push(`<i>нет данных:</i> ${escHtml(gaError)}`);
  } else {
    const o = ga4?.overview;
    if (o) {
      lines.push(`Активные: <b>${escHtml(o.activeUsers)}</b> · Новые: ${escHtml(o.newUsers)}`);
      lines.push(`Сессии: ${escHtml(o.sessions)} · Просмотры: ${escHtml(o.screenPageViews)}`);
      if (o.averageSessionDuration != null) {
        lines.push(`Средняя длина сессии: ${escHtml(formatDurationSeconds(o.averageSessionDuration))}`);
      }
      if (o.engagementRate != null) {
        lines.push(`Вовлечённость (engagement rate): ${escHtml(formatRate(o.engagementRate))}`);
      }
      if (o.eventCount != null) {
        lines.push(`События (event count): ${escHtml(o.eventCount)}`);
      }
    }
    if (ga4?.channels?.length) {
      lines.push('');
      lines.push('<b>Каналы</b> (sessions):');
      for (const ch of ga4.channels) {
        lines.push(`• ${escHtml(ch.channel)} — ${escHtml(ch.sessions)} sess, ${escHtml(ch.users)} users`);
      }
    }
    if (ga4?.topNews?.length) {
      lines.push('');
      lines.push('<b>Топ новостей</b> (просмотры, путь):');
      for (const p of ga4.topNews) {
        const short = p.path.length > 56 ? `${p.path.slice(0, 54)}…` : p.path;
        lines.push(`• <code>${escHtml(short)}</code> — ${escHtml(p.views)} views`);
      }
    }
    if (ga4?.topPaths?.length) {
      lines.push('');
      lines.push('<b>Топ страниц</b> (просмотры):');
      for (const p of ga4.topPaths) {
        const short = p.path.length > 52 ? `${p.path.slice(0, 50)}…` : p.path;
        lines.push(
          `• <code>${escHtml(short)}</code> — ${escHtml(p.views)} views, ${escHtml(p.users)} users`
        );
      }
    }
    if (gaError && hasGa) {
      lines.push('', `<i>часть GA4 недоступна (обзор):</i> ${escHtml(gaError)}`);
    }
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
  const [articles, pendingJobs] = await Promise.all([
    fetchArticlesForDay(startIso, endExclusiveIso),
    fetchPendingJobsCount()
  ]);

  let gscTotals = null;
  let gscNews = null;
  let gscQueries = [];
  let gscError = null;
  /** @type {{ overview: Record<string, string>|null, channels: object[], topPaths: object[], topNews: object[] }} */
  const ga4 = { overview: null, channels: [], topPaths: [], topNews: [] };
  let gaError = null;
  let inspections = [];
  let inspectError = null;

  const auth = await getGoogleReportingAuth().catch(() => null);
  const siteUrl = gscSiteUrl();

  if (!auth) {
    gscError = 'нет JWT (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY) или ошибка авторизации';
    gaError = gscError;
  } else {
    try {
      const [totals, news, queries] = await Promise.all([
        fetchSearchTotals(auth, siteUrl, reportDateYmd),
        fetchNewsPageRows(auth, siteUrl, reportDateYmd),
        fetchGscTopQueries(auth, siteUrl, reportDateYmd, 8)
      ]);
      gscTotals = totals;
      gscNews = news;
      gscQueries = queries;
    } catch (e) {
      gscError = e?.message || String(e);
    }

    const gaProp = process.env.GA4_PROPERTY_ID?.trim();
    if (!gaProp) {
      gaError = 'GA4_PROPERTY_ID не задан (числовой ID ресурса в GA4, не G-…)';
    } else {
      const [rO, rC, rP, rN] = await Promise.allSettled([
        fetchGa4Overview(auth, gaProp, reportDateYmd),
        fetchGa4ChannelBreakdown(auth, gaProp, reportDateYmd),
        fetchGa4TopPaths(auth, gaProp, reportDateYmd),
        fetchGa4TopNewsPaths(auth, gaProp, reportDateYmd)
      ]);
      if (rO.status === 'fulfilled') ga4.overview = rO.value;
      else gaError = rO.reason?.message || String(rO.reason);
      if (rC.status === 'fulfilled') ga4.channels = rC.value;
      if (rP.status === 'fulfilled') ga4.topPaths = rP.value;
      if (rN.status === 'fulfilled') ga4.topNews = rN.value;
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
    pendingJobs,
    gscTotals,
    gscNews,
    gscQueries,
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
