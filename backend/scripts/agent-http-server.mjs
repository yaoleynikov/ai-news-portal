/**
 * HTTP trigger for the same flow as `npm run agent:cycle` (OpenClaw / external cron via curl).
 *
 * POST /api/agent/cycle  Header: Authorization: Bearer <AGENT_CRON_SECRET>
 * GET  /health
 *
 * Env: AGENT_HTTP_PORT (default 8790), AGENT_CRON_SECRET (required for POST)
 */
import http from 'node:http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { runAgentCycle } = await import('../src/agent/run-cycle.js');

const PORT = Number(process.env.AGENT_HTTP_PORT || 8790);
const SECRET = process.env.AGENT_CRON_SECRET?.trim();

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(s)
  });
  res.end(s);
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : '';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    json(res, 200, { ok: true, service: 'siliconfeed-agent', port: PORT });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/agent/cycle') {
    if (!SECRET) {
      json(res, 503, { ok: false, error: 'AGENT_CRON_SECRET is not set' });
      return;
    }
    if (bearer(req) !== SECRET) {
      json(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    try {
      const out = await runAgentCycle();
      json(res, out.ok ? 200 : 500, { ok: out.ok, ...out });
    } catch (e) {
      json(res, 500, { ok: false, error: e.message || String(e) });
    }
    return;
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[agent-http] http://localhost:${PORT}/health`);
  console.log(`[agent-http] POST /api/agent/cycle  Authorization: Bearer <AGENT_CRON_SECRET>`);
});
