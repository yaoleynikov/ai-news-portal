/**
 * Telegram slash commands for worker publish caps (worker_publish_limits).
 * Used by telegram-limits-bot and telegram-admin-bot.
 */
import { getPublishLimitsStatus, updateWorkerPublishLimits } from './publish-limits.js';

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

/**
 * @param {string|number} chatId
 * @param {string} text
 * @param {(chatId: string|number, text: string) => Promise<void>} send
 */
export async function handleTelegramLimitsCommand(chatId, text, send) {
  const { cmd, args } = parseCommand(text);
  if (!cmd || cmd === 'start') {
    await send(chatId, helpText());
    return;
  }

  if (cmd === 'help') {
    await send(chatId, helpText());
    return;
  }

  if (cmd === 'limits' || cmd === 'status') {
    const { envDefaults, dbRow, effective } = await getPublishLimitsStatus();
    const dbLine = dbRow
      ? `DB: ${dbRow.per_hour}/h, ${dbRow.per_day}/day, sleep ${Math.round(dbRow.cap_sleep_ms / 60000)}m`
      : 'DB: (no row — using .env defaults until first /set*)';
    const envLine = `.env fallback: ${envDefaults.perHour}/h, ${envDefaults.perDay}/day`;
    const effLine = `Effective now: ${effective.perHour}/h, ${effective.perDay}/day, sleep ${Math.round(effective.capSleepMs / 60000)}m`;
    await send(chatId, `${effLine}\n${dbLine}\n${envLine}`);
    return;
  }

  if (cmd === 'sethour') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n)) {
      await send(chatId, 'Usage: /sethour <number>  (0 = disable hourly cap)');
      return;
    }
    await updateWorkerPublishLimits({ perHour: n });
    await send(chatId, `OK: per-hour cap set to ${n} (0=off).`);
    return;
  }

  if (cmd === 'setday') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n)) {
      await send(chatId, 'Usage: /setday <number>  (0 = disable daily cap)');
      return;
    }
    await updateWorkerPublishLimits({ perDay: n });
    await send(chatId, `OK: per-day cap set to ${n} (0=off, UTC midnight).`);
    return;
  }

  if (cmd === 'sleepmin') {
    const n = parseInt(args[0], 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      await send(chatId, 'Usage: /sleepmin <1-120>  (minutes after hourly cap)');
      return;
    }
    await updateWorkerPublishLimits({ capSleepMs: n * 60_000 });
    await send(chatId, `OK: hourly-cap sleep = ${n} min.`);
    return;
  }

  if (cmd === 'set') {
    const h = parseInt(args[0], 10);
    const d = parseInt(args[1], 10);
    const m = args[2] !== undefined ? parseInt(args[2], 10) : NaN;
    if (!Number.isFinite(h) || !Number.isFinite(d)) {
      await send(chatId, 'Usage: /set <hour> <day> [sleep_minutes]');
      return;
    }
    const patch = { perHour: h, perDay: d };
    if (Number.isFinite(m) && m >= 1 && m <= 120) {
      patch.capSleepMs = m * 60_000;
    }
    await updateWorkerPublishLimits(patch);
    await send(
      chatId,
      `OK: ${h}/hour, ${d}/day UTC${Number.isFinite(m) && m >= 1 ? `, sleep ${m}m` : ''}`
    );
    return;
  }

  await send(chatId, `Unknown command. ${helpText()}`);
}
