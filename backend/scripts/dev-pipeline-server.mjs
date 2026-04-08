/**
 * HTTP API to run the article + image pipeline (dev / local tools).
 * POST /api/generate  JSON { "url": "https://...", "dryRun": true, "skipDedup": false }
 * GET  /health
 *
 * Default port: PIPELINE_PORT or 8787
 */
import http from 'node:http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runArticlePipeline } from '../src/pipeline/article-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PIPELINE_PORT || 8787);

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(s)
  });
  res.end(s);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    json(res, 200, { ok: true, service: 'siliconfeed-pipeline', port: PORT });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2_000_000) {
        json(res, 413, { ok: false, error: 'body too large' });
        return;
      }
    }
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      json(res, 400, { ok: false, error: 'invalid JSON' });
      return;
    }
    const url = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!url || !/^https?:\/\//i.test(url)) {
      json(res, 400, { ok: false, error: 'missing or invalid url' });
      return;
    }
    const dryRun = Boolean(payload.dryRun);
    const skipDedup = Boolean(payload.skipDedup);
    const localOnly = Boolean(payload.localOnly);
    const embedCoverBase64 = Boolean(payload.embedCoverBase64);

    try {
      const result = await runArticlePipeline(url, {
        dryRun,
        skipDedup,
        localOnly,
        skipPublish: dryRun || localOnly,
        embedCoverBase64: embedCoverBase64 && (dryRun || localOnly)
      });
      const safe = {
        ok: result.ok,
        url: result.url,
        localOnly: result.localOnly,
        steps: result.steps,
        error: result.error,
        extracted: result.extracted,
        rewritten: result.rewritten,
        coverBytes: result.coverBytes,
        coverMime: result.coverMime,
        coverExtension: result.coverExtension,
        coverUrl: result.coverUrl,
        articleId: result.articleId,
        public_url: result.public_url,
        dedup: result.dedup,
        cover_saved_to: result.cover_saved_to
      };
      if (embedCoverBase64 && result.cover_base64) {
        const max = 120_000;
        safe.cover_base64 =
          result.cover_base64.length > max
            ? result.cover_base64.slice(0, max) + '…(truncated)'
            : result.cover_base64;
      }
      json(res, result.ok ? 200 : 422, safe);
    } catch (e) {
      json(res, 500, { ok: false, error: e.message || String(e) });
    }
    return;
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[pipeline-server] listening on http://localhost:${PORT}`);
  console.log(`[pipeline-server] POST /api/generate  body: {"url":"https://...","dryRun":true}`);
});
