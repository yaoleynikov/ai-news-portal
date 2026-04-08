/**
 * API smoke checks — loads backend/.env, prints only ok/fail (no secrets).
 * Usage: from backend/: node scripts/smoke.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { normalizeGooglePrivateKey } from "../src/lib/pem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

function has(val) {
  return Boolean(val && String(val).trim() !== "" && !String(val).includes("your-"));
}

function logoDevToken() {
  return (
    process.env.LOGODEV_API_KEY ||
    process.env.LOGO_DEV_PUBLISHABLE_KEY ||
    process.env.LOGO_DEV_TOKEN
  );
}

function supabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
}

function r2EndpointResolved() {
  const e = process.env.R2_ENDPOINT?.trim();
  if (e) return e;
  const id = process.env.R2_ACCOUNT_ID?.trim();
  return id ? `https://${id}.r2.cloudflarestorage.com` : "";
}

const results = [];

/** @param {'pass' | 'fail' | 'skip'} status */
function row(name, status, note = "") {
  results.push({ name, status, note });
  const label = status === "pass" ? "OK" : status === "skip" ? "SKIP" : "FAIL";
  console.log(`${label}  ${name}${note ? ` — ${note}` : ""}`);
}

// --- Supabase ---
if (!has(process.env.SUPABASE_URL) || !has(supabaseServiceKey())) {
  row("Supabase", "skip", "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY missing");
} else {
  try {
    const sb = createClient(process.env.SUPABASE_URL, supabaseServiceKey());
    const { error: e1 } = await sb.from("jobs").select("id").limit(1);
    if (e1) row("Supabase jobs select", "fail", e1.message);
    else row("Supabase jobs select", "pass");

    const zero384 = `[${Array(384).fill(0).join(",")}]`;
    const { error: e2 } = await sb.rpc("match_articles", {
      query_embedding: zero384,
      match_threshold: 0.99,
      match_count: 1,
    });
    if (e2) row("Supabase RPC match_articles", "fail", e2.message);
    else row("Supabase RPC match_articles", "pass");
  } catch (e) {
    row("Supabase", "fail", e.message);
  }
}

// --- OpenRouter ---
if (!has(process.env.OPENROUTER_API_KEY)) {
  row("OpenRouter", "skip", "OPENROUTER_API_KEY missing");
} else {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (has(process.env.OPENROUTER_HTTP_REFERER)) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
    }
    if (has(process.env.OPENROUTER_APP_TITLE)) {
      headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
    }
    const useJsonObject = process.env.OPENROUTER_JSON_OBJECT === "1";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/auto",
        messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
        ...(useJsonObject ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      row("OpenRouter chat", "fail", `${res.status} ${t.slice(0, 120)}`);
    } else row("OpenRouter chat", "pass");
  } catch (e) {
    row("OpenRouter", "fail", e.message);
  }
}

// --- Hugging Face ---
const HF_MODEL = "black-forest-labs/FLUX.1-schnell";
const hfUrl =
  process.env.HF_INFERENCE_URL ||
  `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

if (!has(process.env.HF_API_KEY)) {
  row("HuggingFace", "skip", "HF_API_KEY missing");
} else {
  try {
    const res = await fetch(hfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: "minimal abstract tech light" }),
    });
    const ok = res.ok || res.status === 503;
    row(
      "HuggingFace inference",
      ok ? "pass" : "fail",
      `${res.status} (${hfUrl.includes("router.huggingface.co") ? "router" : "custom"})`
    );
  } catch (e) {
    row("HuggingFace", "fail", e.message);
  }
}

// --- Logo.dev ---
if (!has(logoDevToken())) {
  row(
    "Logo.dev",
    "skip",
    "LOGODEV_API_KEY / LOGO_DEV_PUBLISHABLE_KEY / LOGO_DEV_TOKEN missing"
  );
} else {
  try {
    const u = `https://img.logo.dev/google.com?token=${logoDevToken()}&size=64&format=png`;
    const res = await fetch(u);
    row("Logo.dev", res.ok ? "pass" : "fail", String(res.status));
  } catch (e) {
    row("Logo.dev", "fail", e.message);
  }
}

// --- R2 ---
const r2Ep = r2EndpointResolved();
if (
  !has(r2Ep) ||
  !has(process.env.R2_ACCESS_KEY_ID) ||
  !has(process.env.R2_SECRET_ACCESS_KEY)
) {
  row("R2", "skip", "R2_ENDPOINT or R2_ACCOUNT_ID + keys missing");
} else {
  try {
    const bucket = process.env.R2_BUCKET_NAME || "siliconfeed-media";
    const client = new S3Client({
      region: "auto",
      endpoint: r2Ep,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    const key = `smoke/smoke-${Date.now()}.txt`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("siliconfeed-smoke"),
        ContentType: "text/plain",
      })
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
    row("R2 PutObject+DeleteObject", "pass");
  } catch (e) {
    row("R2", "fail", e.message);
  }
}

// --- Telegram ---
if (!has(process.env.TG_BOT_TOKEN)) {
  row("Telegram", "skip", "TG_BOT_TOKEN missing");
} else {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/getMe`
    );
    const j = await res.json();
    row(
      "Telegram getMe",
      j.ok ? "pass" : "fail",
      j.ok ? j.result?.username || "ok" : j.description || "error"
    );
  } catch (e) {
    row("Telegram", "fail", e.message);
  }
}

// --- Google JWT (Indexing scope) — no URL publish ---
if (
  !has(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) ||
  !has(process.env.GOOGLE_PRIVATE_KEY)
) {
  row("Google JWT", "skip", "GOOGLE_* missing");
} else {
  try {
    const pem = normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
    if (!pem.includes("BEGIN") || !pem.includes("PRIVATE KEY")) {
      row("Google JWT authorize", "fail", "GOOGLE_PRIVATE_KEY does not look like a PEM key");
    } else {
      const { google } = await import("googleapis");
      const jwtClient = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: pem,
        scopes: ["https://www.googleapis.com/auth/indexing"],
      });
      await jwtClient.authorize();
      row("Google JWT authorize", "pass");
    }
  } catch (e) {
    row("Google JWT authorize", "fail", e.message);
  }
}

const failed = results.filter((r) => r.status === "fail").length;
const passed = results.filter((r) => r.status === "pass").length;
const skipped = results.filter((r) => r.status === "skip").length;
console.log(`\nDone. pass=${passed} fail=${failed} skip=${skipped}`);
process.exit(failed > 0 ? 1 : 0);
