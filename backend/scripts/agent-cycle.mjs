/**
 * SiliconFeed “agent” cycle for cron / OpenClaw:
 * 1) Pull RSS (same as gatekeeper) → enqueue `jobs`
 * 2) Send Telegram digest: queue stats + articles published since last run
 *
 * The worker (`npm run worker`) must be running separately to process the queue.
 *
 * Usage: node scripts/agent-cycle.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { runAgentCycle } = await import('../src/agent/run-cycle.js');

const out = await runAgentCycle();
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
