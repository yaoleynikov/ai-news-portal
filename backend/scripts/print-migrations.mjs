/**
 * Print SQL migrations in order (for Supabase SQL Editor or manual apply).
 * Usage: npm run db:print-migrations > /tmp/all.sql
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "supabase", "migrations");
const files = (await fs.readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const f of files) {
  const body = await fs.readFile(path.join(dir, f), "utf8");
  console.log(`-- === ${f} ===\n${body.trim()}\n`);
}
