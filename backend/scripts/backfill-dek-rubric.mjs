/**
 * Set articles.primary_rubric from tags (same rules as pipeline / primary-rubric.js).
 *
 * Usage:
 *   node scripts/backfill-dek-rubric.mjs              # only rows missing/invalid rubric
 *   node scripts/backfill-dek-rubric.mjs --force      # overwrite all published (use after changing infer rules)
 *   node scripts/backfill-dek-rubric.mjs --dry-run    # print only
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { inferPrimaryRubricFromTags, normalizePrimaryRubric } = await import('../src/lib/primary-rubric.js');

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_KEY?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in backend/.env');
  process.exit(1);
}

const dry = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const valid = new Set(['ai', 'hardware', 'open-source', 'other']);

const supabase = createClient(url, key);
const pageSize = 500;
let from = 0;
let examined = 0;
let updated = 0;

for (;;) {
  const { data, error } = await supabase
    .from('articles')
    .select('id, tags, primary_rubric')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!data?.length) break;

  for (const row of data) {
    examined += 1;
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const next = normalizePrimaryRubric(inferPrimaryRubricFromTags(tags));
    const cur = row.primary_rubric == null ? '' : String(row.primary_rubric).trim().toLowerCase();
    const curOk = valid.has(cur);
    if (!force && curOk) continue;
    if (cur === next) continue;

    if (dry) {
      console.log(`[dry] ${row.id} ${cur || '∅'} -> ${next}`);
    } else {
      const { error: uerr } = await supabase.from('articles').update({ primary_rubric: next }).eq('id', row.id);
      if (uerr) {
        console.error('Update failed', row.id, uerr);
        process.exit(1);
      }
    }
    updated += 1;
  }

  if (data.length < pageSize) break;
  from += pageSize;
}

console.log(
  dry
    ? `Dry run: would update ${updated} of ${examined} published rows (force=${force}).`
    : `Done: updated ${updated} of ${examined} published rows (force=${force}).`
);
