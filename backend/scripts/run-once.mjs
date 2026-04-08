/**
 * One-shot article pipeline from CLI.
 * Usage:
 *   node scripts/run-once.mjs <url> [--local] [--dry-run] [--skip-dedup]
 *
 * --local   No Supabase/R2: extract → OpenRouter → cover; writes tmp/last-cover.webp or .png
 * --dry-run Full pipeline through cover, no upload/insert (DB still used for dedup)
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runArticlePipeline } from '../src/pipeline/article-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.filter((a) => a.startsWith('--')));

const url = argv[0];
if (!url || !/^https?:\/\//i.test(url)) {
  console.error('Usage: node scripts/run-once.mjs <https://...> [--local] [--dry-run] [--skip-dedup]');
  process.exit(1);
}

const local = flags.has('--local');
const dryRun = flags.has('--dry-run');
const skipDedup = flags.has('--skip-dedup');

const coverPath = path.join(backendRoot, 'tmp', 'last-cover.webp'); // extension replaced by pipeline (webp/png)
if (local) {
  fs.mkdirSync(path.join(backendRoot, 'tmp'), { recursive: true });
}

console.log(`[run-once] url=${url} local=${local} dryRun=${dryRun} skipDedup=${skipDedup}\n`);

const out = await runArticlePipeline(url, {
  localOnly: local,
  dryRun: local ? false : dryRun,
  skipDedup,
  skipPublish: local || dryRun,
  saveCoverTo: local ? coverPath : undefined,
  embedCoverBase64: false
});

const { cover_base64, ...printable } = out;
console.log(JSON.stringify(printable, null, 2));
if (local && out.ok && out.cover_saved_to) {
  console.log(`\nCover written: ${out.cover_saved_to}`);
}
process.exit(out.ok ? 0 : 1);
