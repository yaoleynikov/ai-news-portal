/**
 * Long-poll Telegram commands to change worker publish caps (stored in worker_publish_limits).
 *
 * Env: TG_BOT_TOKEN, TG_ADMIN_CHAT_ID (only this chat is accepted; others ignored).
 *
 * Commands:
 *   /help — list commands
 *   /limits — current effective limits + DB vs .env note
 *   /sethour <n> — max publishes per rolling 60 minutes (0 = off)
 *   /setday <n> — max per UTC calendar day (0 = off)
 *   /sleepmin <n> — minutes to sleep when hourly cap is hit (1–120)
 *   /set <hour> <day> [sleep_min] — set hour, day, optional sleep minutes
 *
 * Run: npm run telegram:limits
 * (Keep running alongside the worker, or in a second container.)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { getPublishLimitsStatus, updateWorkerPublishLimits } = await import('../src/lib/publish-limits.js');

const token = process.env.TG_BOT_TOKEN?.trim();
const adminId = process.env.TG_ADMIN_CHAT_ID?.trim();
const POLL_SEC = Math.min(55, Math.max(25, Number(process.env.TG_LIMITS_POLL_SEC || 50) || 50));

function parseCommand(text) {
  const t = (text || '').trim();
  const sp = t.indexOf(' ');
  const head = sp === -1 ? t : t.slice(0, sp);
  const tail = sp === -1 ? '' : t.slice(sp + 1).trim();
  const m = /^\/(\w+)(?:@\S+)?$/i.exec(head);
  if (!m) return { cmd: '', args: [] };
  const args = tail ? tail.split(/\s+/).filter(Boolean) : [];
  return { cmd: m[1].toLowerCase(), args };
}

async function tgSend(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) {
    console.warn('[telegram-limits] sendMessage:', res.status, j.description || j);
  }
}

function helpText() {
  return (
    `SiliconFeed publish limits (worker)\n\n` +
    `/limits — show caps\n` +
    `/sethour N — per rolling hour (0=off)\n` +
    `/setday N — per UTC day (0=off)\n` +
    `/sleepmin N — sleep N min when hourly cap hit\n` +
    `/set H D [M] — hour, day, optional sleep min\n\n` +
    `Example: /set 2 0 10 → 2/hr, no daily cap, 10m sleep`
  );
}

async function handleAdminMessage(chatId, text) {
  const { cmd, args } = parseCommand(text);
  if (!cmd || cmd === 'start' || cmd === 'help') {
    await tgSend(chatId, helpText());
    return;
  }

  if (cmd === 'limits' || cmd === 'status') {
    const { envDefaults, dbRow, effective } = await getPublishLimitsStatus();
    const dbLine = dbRow
      ? `DB: ${dbRow.per_hour}/h, ${dbRow.per_day}/day, sleep ${Math.round(dbRow.cap_sleep_ms / 60000)}m`
      : 'DB: (no row — using .env defaults until first /set*)';
    const envLine = `.env fallback: ${envDefaults.perHour}/h, ${envDefaults.perDay}/day`;
    const effLine = `Effective now: ${effective.perHour}/h, ${effective.perDay}/day, sleep ${Math.round(effective.capSleepMs / 60000)}m`;
    await tgSend(chatId, `${effLine}\n${dbLine}\n${envLine}`);
    return;
  }

  if (cmd === 'sethour') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n)) {
      await tgSend(chatId, 'Usage: /sethour <number>  (0 = disable hourly cap)');
      return;
    }
    await updateWorkerPublishLimits({ perHour: n });
    await tgSend(chatId, `OK: per-hour cap set to ${n} (0=off).`);
    return;
  }

  if (cmd === 'setday') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n)) {
      await tgSend(chatId, 'Usage: /setday <number>  (0 = disable daily cap)');
      return;
    }
    await updateWorkerPublishLimits({ perDay: n });
    await tgSend(chatId, `OK: per-day cap set to ${n} (0=off, UTC midnight).`);
    return;
  }

  if (cmd === 'sleepmin') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      await tgSend(chatId, 'Usage: /sleepmin <1-120>  (minutes after hourly cap)');
      return;
    }
    await updateWorkerPublishLimits({ capSleepMs: n * 60_000 });
    await tgSend(chatId, `OK: hourly-cap sleep = ${n} min.`);
    return;
  }

  if (cmd === 'set') {
    const h = parseInt(args[0], 10);
    const d = parseInt(args[1], 10);
    const m = args[2] !== undefined ? parseInt(args[2], 10) : NaN;
    if (!Number.isFinite(h) || !Number.isFinite(d)) {
      await tgSend(chatId, 'Usage: /set <hour> <day> [sleep_minutes]');
      return;
    }
    const patch = { perHour: h, perDay: d };
    if (Number.isFinite(m) && m >= 1 && m <= 120) {
      patch.capSleepMs = m * 60_000;
    }
    await updateWorkerPublishLimits(patch);
    await tgSend(
      chatId,
      `OK: ${h}/hour, ${d}/day UTC${Number.isFinite(m) && m >= 1 ? `, sleep ${m}m` : ''}`
    );
    return;
  }

  await tgSend(chatId, `Unknown command. ${helpText()}`);
}

async function loop() {
  let offset = 0;
  for (;;) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${POLL_SEC}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!j.ok) {
        console.warn('[telegram-limits] getUpdates:', j.description || j);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of j.result || []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text) continue;
        const fromChat = String(msg.chat.id);
        if (fromChat !== String(adminId)) {
          continue;
        }
        try {
          await handleAdminMessage(msg.chat.id, msg.text);
        } catch (e) {
          console.error('[telegram-limits] handler:', e);
          await tgSend(msg.chat.id, `Error: ${e.message || e}`);
        }
      }
    } catch (e) {
      console.error('[telegram-limits] poll:', e.message || e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

if (!token || !adminId) {
  console.error('[telegram-limits] Set TG_BOT_TOKEN and TG_ADMIN_CHAT_ID in .env');
  process.exit(1);
}

console.log('[telegram-limits] Polling… admin chat:', adminId);
loop();
