/**
 * Long-poll: только команды лимитов воркера (/limits, /sethour, …).
 *
 * Не запускайте с тем же токеном, что и `npm run worker` (в воркер встроен admin-бот) — будет конфликт getUpdates.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { handleTelegramLimitsCommand } from '../src/lib/telegram-limits-handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const token = process.env.TG_BOT_TOKEN?.trim();
const adminId = process.env.TG_ADMIN_CHAT_ID?.trim();
const POLL_SEC = Math.min(55, Math.max(25, Number(process.env.TG_LIMITS_POLL_SEC || 50) || 50));

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

async function loop() {
  let offset = 0;
  let lastConflictLogAt = 0;
  const CONFLICT_LOG_EVERY_MS = 5 * 60 * 1000;
  for (;;) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${POLL_SEC}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!j.ok) {
        const desc = String(j.description || '');
        const conflict =
          j.error_code === 409 || /conflict|terminated by other getupdates/i.test(desc);
        if (conflict) {
          const now = Date.now();
          if (now - lastConflictLogAt >= CONFLICT_LOG_EVERY_MS) {
            lastConflictLogAt = now;
            console.warn(
              '[telegram-limits] getUpdates Conflict — тот же токен уже опрашивается воркером или другим ботом. Остановите дубликат.'
            );
          }
          await new Promise((r) => setTimeout(r, 30000));
          continue;
        }
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
          await handleTelegramLimitsCommand(msg.chat.id, msg.text, tgSend);
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
console.log('[telegram-limits] For article admin too, use: npm run telegram:admin');
loop();
