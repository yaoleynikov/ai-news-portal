import fetch from 'node-fetch';

/**
 * Low-level Telegram Bot API POST (sendMessage, answerCallbackQuery, getUpdates, …).
 * @param {string} botToken
 * @param {string} method e.g. sendMessage
 * @param {Record<string, unknown>} body
 */
export async function telegramApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  try {
    return await res.json();
  } catch {
    return { ok: false, description: 'invalid JSON' };
  }
}

/**
 * Изменить текст своего сообщения (message_id из ответа sendMessage).
 * Ошибка «message is not modified» — если текст не изменился.
 */
export async function telegramEditMessageText(botToken, chatId, messageId, text, extra = {}) {
  return telegramApi(botToken, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: String(text).slice(0, 4090),
    disable_web_page_preview: true,
    ...extra
  });
}

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
  const json = await telegramApi(botToken, 'sendMessage', body);
  if (json.ok === false) {
    console.warn('[telegram] sendMessage failed:', json.description || JSON.stringify(json).slice(0, 200));
    return false;
  }
  return true;
}
