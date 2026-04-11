# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

SiliconFeed is an automated AI-powered tech news aggregator. It has three independent sub-projects under one repo (not an npm workspace):

| Directory | Purpose | Node.js | Port |
|-----------|---------|---------|------|
| `backend/` | Worker process: RSS polling → scraping → AI rewrite → cover generation → publish | >=20 | 8787 (dev pipeline) |
| `frontend/` | Astro 6 SSR site (Vercel adapter) | >=22.12 | 4321 (dev) |
| `research/` | Competitor analysis scripts (optional) | >=20 | — |

### Running the backend

- **Worker** (main process): `cd backend && npm run worker` — infinite loop: RSS gatekeeper → claim jobs → extract → embed → dedup → rewrite → cover → publish → notify. Set `GATEKEEPER_INTERVAL_MS=0` to disable embedded RSS polling.
- **Dev pipeline server**: `cd backend && npm run dev:pipeline` — HTTP server on port 8787. `GET /health` for liveness; `POST /api/generate {"url":"…","dryRun":true,"localOnly":true}` for one-shot article processing.
- **Smoke test**: `cd backend && node scripts/smoke.mjs` — checks all external service connections (Supabase, OpenRouter, HF, R2, Telegram, Google).

### Running the frontend

- `cd frontend && npm run dev` — Astro dev server on port 4321.
- `cd frontend && npm run build` — production build (Vercel SSR).

### Key gotchas

- **No workspace monorepo**: each sub-project has its own `package-lock.json` and `node_modules/`. Run `npm ci` independently in `backend/` and `frontend/`.
- **No linter or test suite**: the project has no ESLint, Biome, or automated tests. `npm test` in backend exits with code 1 ("no test specified").
- **All external services are cloud-hosted**: Supabase (Postgres + pgvector), Cloudflare R2, OpenRouter, Hugging Face, Telegram, Google APIs. No Docker/local DB needed.
- **Local-only components** that work without API keys: article extraction (`src/scraper/extractor.js`) and 384-dim embeddings (`src/brain/embeddings.js`, Xenova/all-MiniLM-L6-v2 on CPU).
- **`.env` files**: copy `.env.example` → `.env` in `backend/`; copy `.env.example` → `.env.local` in `frontend/`. Required secrets are listed in `.env.example` files.
- The worker uses `dotenv` — it loads `backend/.env` automatically. The frontend uses Astro's built-in env loading (`.env.local`).
- `sharp` native module is used by both backend and frontend. If you get build errors after a Node.js version change, delete `node_modules` and re-run `npm ci`.
- **Environment variable conflict**: Cursor Cloud injects secrets as env vars. `dotenv` does NOT override existing env vars by default. If a secret is injected with a truncated value (e.g. `SUPABASE_KEY`), it will shadow the correct `.env` value. Use `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_KEY` in `.env`, or run `unset SUPABASE_KEY GOOGLE_PRIVATE_KEY` before starting the worker/pipeline. The `config.js` checks `SUPABASE_SERVICE_ROLE_KEY` first, then falls back to `SUPABASE_KEY`.
- **Telegram admin bot conflict**: if a production worker is already running, the dev worker's embedded Telegram admin bot will get `getUpdates: Conflict`. This is cosmetic and does not affect core job processing.
- **HuggingFace 402**: if both `HF_API_KEY` and `HF_API_KEY2` hit billing limits, cover generation falls back to an abstract prompt image. The pipeline still succeeds.
