/**
 * Telegram admin bot (limits + статьи): long poll getUpdates.
 * Встраивается в воркер (spinTelegramAdminWithWorker) или запускается отдельно (runTelegramAdminCli).
 */
import { supabase, config } from '../config.js';
import { telegramApi, telegramEditMessageText } from './telegram.js';
import { handleTelegramLimitsCommand } from './telegram-limits-handlers.js';
import {
  findArticleFromUserText,
  deleteArticleById,
  rewriteArticleRow,
  regenerateArticleCoverFromNote,
  toggleArticleCoverType,
  guessLogoDomainFromRow,
  normalizeUserLogoDomain
} from './article-telegram-actions.js';

/** @type {Map<string, { mode: 'image_wait'; articleId: string } | { mode: 'logo_domain_wait'; articleId: string }>} */
const chatState = new Map();

function pollSec() {
  return Math.min(55, Math.max(25, Number(process.env.TG_ADMIN_POLL_SEC || 50) || 50));
}

function isAdminChat(chatId, adminId) {
  return String(chatId) === String(adminId);
}

async function sendPlain(token, chatId, text, extra = {}) {
  const j = await telegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra
  });
  if (!j?.ok) {
    console.warn('[telegram-admin] sendMessage failed:', j?.description || j?.error_code, JSON.stringify(j).slice(0, 500));
  }
  return j?.ok === true;
}

/**
 * Одно сообщение в чате: первый раз sendMessage, дальше editMessageText (прогресс в Telegram).
 */
function makeProgressMessenger(token, chatId) {
  let messageId = null;
  let lastText = '';
  return {
    async show(text) {
      const t = String(text).slice(0, 4000);
      if (t === lastText) return;
      lastText = t;
      if (messageId == null) {
        const j = await telegramApi(token, 'sendMessage', {
          chat_id: chatId,
          text: t,
          disable_web_page_preview: true
        });
        if (j?.ok) messageId = j.result.message_id;
        else console.warn('[telegram-admin] progress sendMessage:', j?.description);
        return;
      }
      const j = await telegramEditMessageText(token, chatId, messageId, t);
      if (j?.ok === false) {
        const desc = String(j?.description || '').toLowerCase();
        if (!desc.includes('message is not modified') && !desc.includes('not modified')) {
          console.warn('[telegram-admin] progress editMessageText:', j?.description);
        }
      }
    }
  };
}

async function answerCb(token, callbackQueryId, text) {
  await telegramApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text ? String(text).slice(0, 200) : undefined
  });
}

function articleKeyboard(articleId) {
  const id = String(articleId).toLowerCase();
  return {
    inline_keyboard: [
      [
        { text: '🗑 Удалить', callback_data: `sf:d:${id}` },
        { text: '✏️ Рерайт', callback_data: `sf:r:${id}` },
        { text: '🖼 Обложка', callback_data: `sf:i:${id}` }
      ],
      [{ text: '🔁 Тип: лого ⟷ фото', callback_data: `sf:t:${id}` }]
    ]
  };
}

function logoDomainCancelKeyboard(articleId) {
  const id = String(articleId).toLowerCase();
  return {
    inline_keyboard: [[{ text: '✖ Отмена', callback_data: `sf:x:${id}` }]]
  };
}

/**
 * @param {{ exitOnFatal?: boolean }} opts exitOnFatal: process.exit(1) on token/webhook errors (CLI)
 */
export async function bootstrapTelegramAdmin(token, adminId, opts = {}) {
  const exitOnFatal = opts.exitOnFatal === true;
  const fail = (msg) => {
    console.error('[telegram-admin]', msg);
    if (exitOnFatal) process.exit(1);
    throw new Error(msg);
  };

  const me = await telegramApi(token, 'getMe', {});
  if (!me?.ok) {
    fail(`getMe: ${me?.description || JSON.stringify(me)}`);
  }
  const un = me.result?.username || '?';
  console.log(`[telegram-admin] Токен OK — бот @${un}`);

  const wh = await telegramApi(token, 'getWebhookInfo', {});
  if (wh?.ok && wh.result?.url) {
    console.warn(
      '[telegram-admin] Был webhook (входящие не шли в long poll). Снимаю:',
      wh.result.url
    );
  }
  const del = await telegramApi(token, 'deleteWebhook', { drop_pending_updates: false });
  if (!del?.ok) {
    fail(`deleteWebhook: ${del?.description || JSON.stringify(del)}`);
  }

  console.log('[telegram-admin] Long polling, admin chat:', adminId);
}

async function handleMessage(token, adminId, msg) {
  const chatId = msg.chat?.id;
  const textRaw = (
    typeof msg.text === 'string'
      ? msg.text
      : typeof msg.caption === 'string'
        ? msg.caption
        : ''
  ).trim();
  const text = textRaw;

  async function limitsSend(cid, t) {
    await sendPlain(token, cid, t);
  }

  if (text === '/myid' || text === '/chatid') {
    const kind = msg.chat?.type || '?';
    await sendPlain(
      token,
      chatId,
      `Этот чат:\nchat.id = \`${chatId}\`\ntype = ${kind}\n\nДля лички с ботом TG_ADMIN_CHAT_ID = этот chat.id.\nВ группе — id группы (часто отрицательный).`
    );
    return;
  }

  if (!isAdminChat(chatId, adminId)) {
    const looksLikeArticle =
      /siliconfeed|\/news\/|https?:\/\//i.test(text) || /^[a-z0-9][a-z0-9-]+$/i.test(text);
    if (looksLikeArticle) {
      await sendPlain(
        token,
        chatId,
        `Нет доступа: chat.id (${chatId}) ≠ TG_ADMIN_CHAT_ID.\n/myid — узнать id чата, затем перезапусти воркер.`
      );
    }
    return;
  }

  if (!text) {
    await sendPlain(
      token,
      chatId,
      'Пришли текстом ссылку на статью (SiliconFeed /news/… или URL источника) или slug.'
    );
    return;
  }

  if (text === '/cancel' || text === '/отмена') {
    chatState.delete(String(chatId));
    await sendPlain(token, chatId, 'Ок, отмена.');
    return;
  }

  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0]?.split('@')[0] || text;
    console.log('[telegram-admin] Команда лимитов:', cmd);
    await handleTelegramLimitsCommand(chatId, text, limitsSend);
    return;
  }

  const pending = chatState.get(String(chatId));
  if (pending?.mode === 'logo_domain_wait') {
    const dom = normalizeUserLogoDomain(text);
    if (!dom) {
      await sendPlain(
        token,
        chatId,
        'Не похоже на домен. Пришли hostname одной строкой, например `openai.com` или `https://company.com`\n/cancel — отмена.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    chatState.delete(String(chatId));
    const prog = makeProgressMessenger(token, chatId);
    try {
      await prog.show('⏳ Загружаю статью из БД…');
      const { data: row, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', pending.articleId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error('Статья не найдена');
      const out = await toggleArticleCoverType(supabase, row, {
        logoDomain: dom,
        onProgress: (line) => prog.show(line)
      });
      const typeRu = out.cover_type === 'company' ? 'лого (company)' : 'фото (abstract)';
      let tail = `\nТип в БД: ${typeRu}\n${out.cover_url}`;
      if (out.direction === 'to_company' && out.domain_used) {
        tail = `\nДомен Logo.dev: ${out.domain_used}${out.used_fallback_image ? ' (лого не вышло — оставлено FLUX)' : ''}${tail}`;
      }
      await prog.show(`✅ Тип обложки переключён${tail}`);
    } catch (e) {
      console.error('[telegram-admin] Домен для лого: ошибка', e?.message || e);
      try {
        await prog.show(`❌ Смена типа: ${e.message || e}`);
      } catch {
        await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
      }
    }
    return;
  }

  if (pending?.mode === 'image_wait') {
    chatState.delete(String(chatId));
    console.log('[telegram-admin] Обложка: старт для id=', pending.articleId, 'заметка:', text.slice(0, 120));
    const prog = makeProgressMessenger(token, chatId);
    try {
      await prog.show('⏳ Обложка: загружаю статью из БД…');
      const { data: row, error } = await supabase.from('articles').select('*').eq('id', pending.articleId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error('Статья не найдена');
      const out = await regenerateArticleCoverFromNote(supabase, row, text, {
        onProgress: (line) => prog.show(line)
      });
      console.log('[telegram-admin] Обложка: готово', row.slug || row.id, '→', out.cover_url?.slice(0, 80));
      await prog.show(
        `✅ Обложка обновлена\n\nПромпт:\n${out.prompt_used.slice(0, 900)}${out.prompt_used.length > 900 ? '…' : ''}\n\n${out.cover_url}`
      );
    } catch (e) {
      console.error('[telegram-admin] Обложка: ошибка', e?.message || e);
      try {
        await prog.show(`❌ Ошибка: ${e.message || e}`);
      } catch {
        await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
      }
    }
    return;
  }

  try {
    console.log('[telegram-admin] Поиск статьи по:', text.slice(0, 200));
    const row = await findArticleFromUserText(supabase, text);
    if (!row) {
      console.log('[telegram-admin] Статья не найдена');
      await sendPlain(
        token,
        chatId,
        'Не нашёл статью. Пришли:\n• https://…/news/slug\n• или полный URL первоисточника\n• или slug одной строкой'
      );
      return;
    }
    const slug = typeof row.slug === 'string' ? row.slug : '';
    console.log('[telegram-admin] Найдена статья slug=', slug, 'id=', row.id, 'title=', String(row.title || '').slice(0, 60));
    const title = typeof row.title === 'string' ? row.title.slice(0, 500) : '';
    const url = slug ? `${config.publicSiteUrl.replace(/\/$/, '')}/news/${slug}` : '';
    const head = `Нашёл: ${title}${url ? `\n${url}` : ''}\n\nЧто сделать?`;
    const ok = await sendPlain(token, chatId, head, {
      reply_markup: articleKeyboard(row.id)
    });
    if (!ok) {
      await sendPlain(
        token,
        chatId,
        'Не удалось отправить кнопки — см. лог воркера / процесса telegram:admin.'
      );
    }
  } catch (e) {
    await sendPlain(token, chatId, `Ошибка поиска: ${e.message || e}`);
  }
}

async function handleCallback(token, adminId, cb) {
  const chatId = cb.message?.chat?.id;
  if (!isAdminChat(chatId, adminId)) {
    await answerCb(token, cb.id);
    return;
  }

  const data = typeof cb.data === 'string' ? cb.data : '';
  const m = /^sf:([dritx]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(data);
  if (!m) {
    await answerCb(token, cb.id, 'Неверная кнопка');
    return;
  }

  const act = m[1].toLowerCase();
  const articleId = m[2];

  const { data: row, error } = await supabase.from('articles').select('*').eq('id', articleId).maybeSingle();
  if (error || !row) {
    await answerCb(token, cb.id, 'Не найдено');
    await sendPlain(token, chatId, 'Статья не найдена.');
    return;
  }

  try {
    if (act === 'd') {
      console.log('[telegram-admin] Удаление:', row.slug || articleId, row.title);
      await answerCb(token, cb.id, 'Удаляю…');
      const prog = makeProgressMessenger(token, chatId);
      try {
        await prog.show('🗑 Удаляю статью из базы…');
        await deleteArticleById(supabase, articleId, {
          slug: typeof row.slug === 'string' ? row.slug : undefined
        });
        chatState.delete(String(chatId));
        console.log('[telegram-admin] Удалено из БД:', row.slug || articleId);
        await prog.show(`🗑 Удалено\n${row.title}`);
      } catch (e) {
        try {
          await prog.show(`❌ Удаление: ${e.message || e}`);
        } catch {
          await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
        }
      }
      return;
    }
    if (act === 'r') {
      console.log('[telegram-admin] Рерайт: старт', row.slug || articleId, '| source:', row.source_url || '(нет)');
      await answerCb(token, cb.id, 'Рерайт…');
      const prog = makeProgressMessenger(token, chatId);
      try {
        const out = await rewriteArticleRow(supabase, row, {
          onProgress: (line) => prog.show(line)
        });
        chatState.delete(String(chatId));
        console.log('[telegram-admin] Рерайт: готово', out.slug, '|', String(out.title || '').slice(0, 70));
        const url = `${config.publicSiteUrl.replace(/\/$/, '')}/news/${out.slug}`;
        await prog.show(`✅ Рерайт готов\n\n${out.title}\n${url}`);
      } catch (e) {
        console.error('[telegram-admin] Рерайт: ошибка', e?.message || e);
        try {
          await prog.show(`❌ Рерайт: ${e.message || e}`);
        } catch {
          await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
        }
      }
      return;
    }
    if (act === 'i') {
      console.log('[telegram-admin] Жду текст заметки для обложки:', row.slug || articleId);
      await answerCb(token, cb.id);
      chatState.set(String(chatId), { mode: 'image_wait', articleId });
      await sendPlain(
        token,
        chatId,
        'Напиши одним сообщением, какой должна быть обложка — я соберу из этого промпт для генератора.\n/cancel — отмена.'
      );
      return;
    }
    if (act === 't') {
      console.log('[telegram-admin] Смена типа обложки:', row.slug || articleId, 'cover_type=', row.cover_type);
      if (row.cover_type !== 'company' && !guessLogoDomainFromRow(row)) {
        await answerCb(token, cb.id, 'Жду домен');
        chatState.set(String(chatId), { mode: 'logo_domain_wait', articleId });
        await sendPlain(
          token,
          chatId,
          'Не смог угадать домен для Logo.dev (агрегатор в URL или неочевидный бренд).\n\nПришли **домен одной строкой** — как в Logo.dev, например `anthropic.com` или `https://stripe.com`\n/cancel — отмена.',
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: logoDomainCancelKeyboard(articleId)
          }
        );
        return;
      }
      await answerCb(token, cb.id, 'Меняю обложку…');
      const prog = makeProgressMessenger(token, chatId);
      try {
        const out = await toggleArticleCoverType(supabase, row, {
          onProgress: (line) => prog.show(line)
        });
        chatState.delete(String(chatId));
        const typeRu = out.cover_type === 'company' ? 'лого (company)' : 'фото (abstract)';
        let tail = `\nТип в БД: ${typeRu}\n${out.cover_url}`;
        if (out.direction === 'to_company' && out.domain_used) {
          tail = `\nДомен Logo.dev: ${out.domain_used}${out.used_fallback_image ? ' (лого не вышло — оставлено FLUX)' : ''}${tail}`;
        }
        await prog.show(`✅ Тип обложки переключён${tail}`);
      } catch (e) {
        console.error('[telegram-admin] Смена типа: ошибка', e?.message || e);
        try {
          await prog.show(`❌ Смена типа: ${e.message || e}`);
        } catch {
          await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
        }
      }
      return;
    }
    if (act === 'x') {
      const pend = chatState.get(String(chatId));
      if (
        pend?.mode === 'logo_domain_wait' &&
        String(pend.articleId).toLowerCase() === String(articleId).toLowerCase()
      ) {
        chatState.delete(String(chatId));
        await answerCb(token, cb.id, 'Отменено');
        await sendPlain(token, chatId, 'Ок, смена типа на лого отменена.');
        return;
      }
      await answerCb(token, cb.id);
      return;
    }
  } catch (e) {
    console.error('[telegram-admin] Действие', act, 'ошибка:', e?.message || e);
    await answerCb(token, cb.id, 'Ошибка');
    await sendPlain(token, chatId, `Ошибка: ${e.message || e}`);
  }
}

export async function runTelegramAdminPollLoop(token, adminId) {
  let offset = 0;
  const timeout = pollSec();
  for (;;) {
    try {
      const j = await telegramApi(token, 'getUpdates', {
        offset,
        timeout,
        allowed_updates: ['message', 'callback_query']
      });
      if (!j.ok) {
        console.warn('[telegram-admin] getUpdates:', j.description || j);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const batch = j.result || [];
      if (batch.length > 0) {
        console.log('[telegram-admin] Входящих обновлений от Telegram:', batch.length);
      }
      for (const u of batch) {
        offset = u.update_id + 1;
        try {
          if (u.message) await handleMessage(token, adminId, u.message);
          else if (u.callback_query) await handleCallback(token, adminId, u.callback_query);
        } catch (e) {
          console.error('[telegram-admin] handler:', e);
          const cid = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
          if (cid) await sendPlain(token, cid, `Ошибка: ${e.message || e}`);
        }
      }
    } catch (e) {
      console.error('[telegram-admin] poll:', e.message || e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

/**
 * Запуск фонового long-poll в том же процессе, что и воркер.
 * Отключение: TG_WORKER_TELEGRAM_ADMIN=0
 */
export function spinTelegramAdminWithWorker() {
  const off = String(process.env.TG_WORKER_TELEGRAM_ADMIN || '').trim().toLowerCase();
  if (off === '0' || off === 'false' || off === 'off') {
    console.log('[SEQUENCER] Встроенный Telegram admin bot выключен (TG_WORKER_TELEGRAM_ADMIN=0).');
    return;
  }

  const token = process.env.TG_BOT_TOKEN?.trim();
  const adminId = process.env.TG_ADMIN_CHAT_ID?.trim();
  if (!token || !adminId) {
    return;
  }

  void (async () => {
    try {
      await bootstrapTelegramAdmin(token, adminId, { exitOnFatal: false });
      console.log('[SEQUENCER] Telegram admin bot слушает чат (тот же процесс, что и воркер).');
      await runTelegramAdminPollLoop(token, adminId);
    } catch (e) {
      console.error('[telegram-admin] встроенный бот остановлен:', e?.message || e);
    }
  })();
}

/** Отдельный запуск: npm run telegram:admin */
export async function runTelegramAdminCli() {
  const token = process.env.TG_BOT_TOKEN?.trim();
  const adminId = process.env.TG_ADMIN_CHAT_ID?.trim();
  if (!token || !adminId) {
    console.error('[telegram-admin] Нужны TG_BOT_TOKEN и TG_ADMIN_CHAT_ID в .env');
    process.exit(1);
  }
  await bootstrapTelegramAdmin(token, adminId, { exitOnFatal: true });
  await runTelegramAdminPollLoop(token, adminId);
}
