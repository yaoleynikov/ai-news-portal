import fetch from 'node-fetch';

/**
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} text
 * @param {{ parseMode?: 'Markdown' | 'HTML' | null, disableWebPagePreview?: boolean }} [opts]
 */
export async function sendTelegramMessage(botToken, chatId, text, opts = {}) {
  const body = { chat_id: chatId, text };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.disableWebPagePreview) body.disable_web_page_preview = true;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || json.ok === false) {
    console.warn(
      '[telegram] sendMessage failed:',
      res.status,
      json.description || JSON.stringify(json).slice(0, 200)
    );
    return false;
  }
  return true;
}
