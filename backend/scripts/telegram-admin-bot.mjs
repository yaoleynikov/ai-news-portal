/**
 * Только long-poll админ-бота (без воркера). Обычно не нужен: то же самое встроено в `npm run worker`.
 * Используйте, если хотите бота без обработки очереди статей.
 *
 * С тем же TG_BOT_TOKEN не запускайте одновременно с воркером или telegram:limits — один getUpdates на токен.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTelegramAdminCli } from '../src/lib/telegram-admin-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

runTelegramAdminCli().catch((e) => {
  console.error('[telegram-admin]', e);
  process.exit(1);
});
