import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, config } from '../config.js';
import { runGatekeeper } from '../gatekeeper/cron.js';
import { sendTelegramMessage } from '../lib/telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..', '..');

function statePath() {
  const p = process.env.AGENT_STATE_FILE?.trim();
  return path.isAbsolute(p || '') ? p : path.join(backendRoot, p || 'tmp/last-agent-cycle.json');
}

function lookbackMinutes() {
  const n = Number(process.env.AGENT_LOOKBACK_MINUTES ?? 120);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : 120;
}

async function readLastCycleIso() {
  try {
    const raw = await fs.readFile(statePath(), 'utf8');
    const j = JSON.parse(raw);
    if (typeof j.lastIso === 'string' && j.lastIso) return j.lastIso;
  } catch {
    /* no file */
  }
  return new Date(Date.now() - lookbackMinutes() * 60_000).toISOString();
}

async function writeLastCycleIso(iso) {
  const dir = path.dirname(statePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(statePath(), JSON.stringify({ lastIso: iso }, null, 2), 'utf8');
}

/**
 * One agent cycle: RSS → enqueue jobs, then Telegram digest of articles published since last cycle.
 * Processing still happens in `npm run worker`; this does not block on the queue.
 */
export async function runAgentCycle() {
  const since = await readLastCycleIso();
  const nowIso = new Date().toISOString();

  let gatekeeper;
  try {
    gatekeeper = await runGatekeeper();
  } catch (e) {
    return {
      ok: false,
      gatekeeper: {
        ok: false,
        candidatesTotal: 0,
        enqueued: 0,
        skippedPublished: 0,
        skippedAlreadyQueued: 0,
        stuckRecovered: 0,
        feedFailures: [],
        error: e.message
      },
      published: [],
      telegramSent: false,
      error: e.message
    };
  }

  const { data: rows, error: qErr } = await supabase
    .from('articles')
    .select('slug, title, created_at')
    .eq('status', 'published')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (qErr) {
    console.error('[agent-cycle] articles query failed:', qErr.message);
  }

  const published = (rows || [])
    .filter((r) => r.slug && String(r.slug).trim())
    .map((r) => ({
      slug: String(r.slug),
      title: String(r.title || ''),
      url: `${config.publicSiteUrl}/news/${r.slug}`
    }));

  const token = process.env.TG_BOT_TOKEN?.trim();
  const adminChat = process.env.TG_ADMIN_CHAT_ID?.trim();
  let telegramSent = false;

  if (token && adminChat) {
    const lines = [
      'SiliconFeed — agent cycle',
      '',
      `RSS: ${gatekeeper.enqueued} new job(s) enqueued`,
      `Candidates: ${gatekeeper.candidatesTotal} · already on site: ${gatekeeper.skippedPublished} · already in queue: ${gatekeeper.skippedAlreadyQueued}`,
      ''
    ];
    if (gatekeeper.stuckRecovered > 0) {
      lines.push(`Recovered stuck jobs: ${gatekeeper.stuckRecovered}`, '');
    }
    if (gatekeeper.feedFailures?.length) {
      lines.push('Feed errors:', ...gatekeeper.feedFailures.slice(0, 8).map((f) => `· ${f}`), '');
    }
    lines.push(`Published since last report (${published.length}):`, '');
    const maxLines = 25;
    const show = published.slice(0, maxLines);
    for (const p of show) {
      lines.push(`· ${p.title.slice(0, 200)}`);
      lines.push(`  ${p.url}`);
    }
    if (published.length > maxLines) {
      lines.push('', `…and ${published.length - maxLines} more`);
    }
    if (published.length === 0) {
      lines.push('(No new articles in this window yet — worker may still be processing the queue.)');
    }

    const text = lines.join('\n').slice(0, 3900);
    telegramSent = await sendTelegramMessage(token, adminChat, text, { disableWebPagePreview: true });

    if (process.env.TG_CHANNEL_ID?.trim() && process.env.AGENT_DIGEST_TO_CHANNEL === '1') {
      await sendTelegramMessage(token, process.env.TG_CHANNEL_ID.trim(), text, { disableWebPagePreview: true });
    }
  } else {
    console.warn('[agent-cycle] TG_BOT_TOKEN or TG_ADMIN_CHAT_ID missing — digest not sent');
  }

  await writeLastCycleIso(nowIso);

  return { ok: true, gatekeeper, published, telegramSent };
}
