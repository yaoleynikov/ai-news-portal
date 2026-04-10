import fetch from 'node-fetch';
import { config } from '../config.js';
import { FALLBACK_ABSTRACT_COVER_KEYWORD } from '../media/generator.js';
import { finalizeArticleSlug } from '../lib/slug.js';
import { normalizePrimaryRubric } from '../lib/primary-rubric.js';

function rewriterMaxTokens() {
  const n = parseInt(process.env.REWRITER_MAX_TOKENS || '', 10);
  if (Number.isFinite(n) && n >= 1024 && n <= 32000) return n;
  return 10240;
}

function rewriterMaxAttempts() {
  const n = parseInt(process.env.REWRITER_MAX_ATTEMPTS || '', 10);
  if (Number.isFinite(n) && n >= 1 && n <= 6) return n;
  return 3;
}

/**
 * Whether to run another OpenRouter call: truncation, or body far too short vs clipped source.
 * @param {number} inputLen clipped source character count
 * @param {number} contentMdLen normalized content_md length
 * @param {string} finishReason choice.finish_reason
 */
export function needsRewriterLengthRetry(inputLen, contentMdLen, finishReason) {
  const fr = String(finishReason || '');
  if (fr === 'length') return true;
  if (contentMdLen >= 2600) return false;
  if (inputLen < 1100) return false;
  if (inputLen >= 1500 && contentMdLen < 650) return true;
  if (inputLen >= 2200 && contentMdLen < 950) return true;
  if (inputLen >= 1400 && inputLen <= 9000 && contentMdLen < inputLen * 0.38) return true;
  return false;
}

function rewriterRetrySuffix(prevOutLen, inputLen, finishReason) {
  const fr = String(finishReason || '');
  const extra =
    fr === 'length'
      ? ' The last run hit the output token limit (truncated JSON).'
      : '';
  return `

---
**EDITOR RETRY (required):**${extra} The previous attempt's "content_md" field was too short (~${prevOutLen} characters) for a source of ~${inputLen} characters. Rewrite again from the same TITLE and CONTENT above. Output the **full** article: multiple H2 (##) sections, long paragraphs, every list and number from the source — not a blurb. One complete JSON object only (no markdown fences).`;
}

/** OpenRouter / OpenAI-style message.content: string or array of parts */
function messageTextContent(message) {
  if (!message) return '';
  const c = message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (part.type === 'text' && typeof part.text === 'string') return part.text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

/** Strip ```json fences if the model wraps output */
function unwrapJsonContent(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) return fence[1].trim();
  return s;
}

/**
 * Models often emit raw newlines/tabs inside JSON string values; `JSON.parse` rejects them.
 * Escape those only while inside quoted strings (respect \\ and \").
 */
function escapeRawControlsInJsonStrings(text) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) {
      out += c;
      esc = false;
      continue;
    }
    if (c === '\\') {
      out += c;
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      out += c;
      continue;
    }
    if (inStr) {
      const code = c.charCodeAt(0);
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
        out += '\\n';
        continue;
      }
      if (c === '\n' || c === '\r') {
        out += '\\n';
        continue;
      }
      if (c === '\t') {
        out += '\\t';
        continue;
      }
      if (code < 0x20 || code === 0x7f) {
        out += ' ';
        continue;
      }
    }
    out += c;
  }
  return out;
}

function parseRewriterModelJson(unwrapped) {
  try {
    return JSON.parse(unwrapped);
  } catch (first) {
    try {
      return JSON.parse(escapeRawControlsInJsonStrings(unwrapped));
    } catch {
      throw first;
    }
  }
}

/**
 * Capitalize the first letter of `##` / `###` lines if the model emitted all-lowercase headings.
 * Skips "### At a glance:".
 */
/**
 * Remove a trailing FAQ section from Markdown body. FAQ is stored only in JSON `faq`;
 * duplicating it here causes double FAQ on /news/[slug].
 */
export function stripFaqSectionFromContentMd(md) {
  if (typeof md !== 'string' || !md) return md;
  const lines = md.split(/\r?\n/);
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^#{1,6}\s+(faqs?|frequently asked questions)\s*:?\s*$/i.test(t)) {
      cut = i;
      break;
    }
  }
  if (cut < 0) return md;
  return lines
    .slice(0, cut)
    .join('\n')
    .replace(/[ \t]+\r?\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

export function ensureHeadingSentenceStart(md) {
  if (typeof md !== 'string' || !md) return md;
  return md
    .split(/\r?\n/)
    .map((line) => {
      const m = /^(#{2,3})\s+(.*)$/.exec(line);
      if (!m) return line;
      const hashes = m[1];
      const rest = m[2];
      if (/^\s*At a glance\b/i.test(rest)) return line;
      const trimmed = rest.trimStart();
      if (!trimmed.length || !/^[a-z]/.test(trimmed[0])) return line;
      const leadLen = rest.length - trimmed.length;
      const lead = rest.slice(0, leadLen);
      return `${hashes} ${lead}${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
    })
    .join('\n');
}

/**
 * @param {unknown} parsed
 */
export function normalizeRewritten(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Rewriter: model returned non-object JSON');
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  let content_md = typeof o.content_md === 'string' ? o.content_md.trim() : '';
  content_md = ensureHeadingSentenceStart(content_md);
  content_md = stripFaqSectionFromContentMd(content_md);
  if (!title || !content_md) {
    throw new Error('Rewriter: missing title or content_md');
  }
  let tags = Array.isArray(o.tags) ? o.tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  if (tags.length === 0) tags = ['Tech'];
  if (tags.length > 8) tags = tags.slice(0, 8);

  const cover_type = o.cover_type === 'company' ? 'company' : 'abstract';
  let cover_keyword =
    typeof o.cover_keyword === 'string' && o.cover_keyword.trim()
      ? o.cover_keyword.trim()
      : FALLBACK_ABSTRACT_COVER_KEYWORD;
  if (cover_keyword.length > 200) cover_keyword = cover_keyword.slice(0, 200);

  let faq = Array.isArray(o.faq) ? o.faq : [];
  faq = faq
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const q = /** @type {Record<string, unknown>} */ (x);
      return {
        q: typeof q.q === 'string' ? q.q.trim() : '',
        a: typeof q.a === 'string' ? q.a.trim() : ''
      };
    })
    .filter((x) => x.q && x.a);
  while (faq.length < 3) {
    faq.push({
      q: 'What is this article about?',
      a: 'A concise recap of the main points from the story above.'
    });
  }
  if (faq.length > 6) faq = faq.slice(0, 6);

  let entities = Array.isArray(o.entities) ? o.entities : [];
  entities = entities
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const e = /** @type {Record<string, unknown>} */ (x);
      return {
        name: typeof e.name === 'string' ? e.name.trim() : '',
        desc: typeof e.desc === 'string' ? e.desc.trim() : ''
      };
    })
    .filter((x) => x.name);
  if (entities.length > 12) entities = entities.slice(0, 12);

  let sentiment = Number(o.sentiment);
  if (!Number.isFinite(sentiment)) sentiment = 5;
  sentiment = Math.min(10, Math.max(1, Math.round(sentiment)));

  const slug = finalizeArticleSlug(o.slug, title);

  let dek = typeof o.dek === 'string' ? o.dek.replace(/\s+/g, ' ').trim() : '';
  if (dek.length > 280) dek = `${dek.slice(0, 276).trim()}…`;
  if (dek.length < 24) {
    const plain = content_md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    dek = plain.length >= 40 ? `${plain.slice(0, 236).trim()}…` : title.slice(0, 200);
  }
  const primary_rubric = normalizePrimaryRubric(o.primary_rubric);

  return {
    title,
    slug,
    content_md,
    tags,
    cover_type,
    cover_keyword,
    dek,
    primary_rubric,
    faq,
    entities,
    sentiment
  };
}

/**
 * Standardizes raw scraped text into high-quality IT/AI news in English.
 * Output is STRICT JSON corresponding to our Supabase schema.
 */
export async function rewriteArticle(title, content) {
  if (!config.ai.openRouterKey) {
    throw new Error('OPENROUTER_API_KEY is missing from environment.');
  }

  const body = typeof content === 'string' ? content : '';
  const maxIn = config.limits.maxChars;
  const clipped = body.length > maxIn ? body.substring(0, maxIn) : body;

  const prompt = `You are an elite Lead Tech Editor at a premium IT/AI news site.
Your task is to take a raw scraped article and rewrite it into a deep, readable news piece in **English** (US/UK neutral).
The tone should be modern and tech-savvy, but the piece must feel substantial — not a short digest.

Rules:
1. Title in English: strong and clear for SEO. Use sentence case — capitalize only the first word and proper nouns (OpenAI, AWS, EU). Do NOT use title case on every word.
2. The content MUST be valid Markdown only (no HTML).
3. **Factual fidelity:** Copy-preserving beats paraphrase. Keep every concrete datum from the source: product and model names, version numbers, dates, regions/countries, prices, statistics, quotes (attributed), and **any enumerated lists** (devices, features, steps). If the source lists phones, SKUs, or beta regions, reproduce them as Markdown bullet or numbered lists — do not collapse them into vague prose. Never drop the list that is the core of the story.
4. CRITICAL: Start the Markdown with an H3 heading "### At a glance:" then exactly 3 bullet lines (- item) with the key takeaways (may name specific models/regions if that is the news).
5. After that, add \`##\` headings **only when the topic actually shifts** — never on a fixed rhythm, character count, or to pad length. Each \`##\` must introduce a block with **at least two paragraphs** (3+ sentences each) unless the source is extremely thin.
   - Strong source: up to 5–7 \`##\` sections, each with real substance; aim for ~12–20 solid paragraphs total after "At a glance".
   - Weak/short source: prefer **1–3** \`##\` sections (e.g. one \`## What happened\` plus \`## Why it matters\`) — **do not** invent many empty sections.
6. **Depth:** After "At a glance", write **at least six full body paragraphs** for any story with more than a headline. Never output a 3–4 sentence "micro-article" when the scraped text contains more facts — expand with context, who is affected, history, and what to watch next, **without removing** the specific enumerations above.
7. **Heading style:** Every \`##\` and \`###\` line uses **sentence case** (first word + proper nouns like WireGuard, Microsoft capitalized). Do **not** use all-lowercase heading lines.
8. Do not repeat the same fact in different words across sections; add new angles (how it works, who it affects, limitations, timeline) instead — but **do not** omit lists or numbers already in the source.
9. Extract 3–6 concise tags in English.
10. Cover strategy (text is sent to an image model; it must be **literal and grounded**, not sci-fi):
   - company: Only if the story is clearly about one well-known tech brand/product. cover_keyword MUST be a real domain like "openai.com" or "google.com" (no paths).
   - abstract: For general or multi-vendor topics. cover_keyword = one **concrete, present-day** scene (10–18 words): real lighting, ordinary environments (office, street, home desk, hands holding a phone, lab bench, conference room). Describe what would plausibly appear in a news photo for this topic. **Forbidden** in cover_keyword: "futuristic", "sci-fi", "cyberpunk", "hologram", "neon city", "space", "android robot", "laser", "matrix", "digital warrior", "metaphor for". No brand names or logos in cover_keyword.
11. slug: one unique URL slug in English, lowercase kebab-case (a-z, 0-9, hyphens), 3–60 chars, no year spam; derived from the topic (for /news/[slug]). Every word must be its own segment — never glue two words (wrong: newssamsung-admin; right: news-samsung-admin).
12. Exactly 3 FAQ items (q/a in English), grounded in the article; answers should be informative (3–6 sentences each), not one-liners; include specifics (models, regions) when the article lists them. Put FAQ **only** in the JSON \`faq\` array — **never** add a "## FAQs", "## FAQ", "### FAQ", or any Q&A block inside \`content_md\`. The Markdown body must end with your last substantive section (e.g. conclusion); the site renders \`faq\` separately.
13. entities: 4–8 notable companies, products, or people from the text (name + one-line description in English).
14. sentiment: integer 1–10 (market/tech tone for investors/readers).
15. dek: **Plain text only** (no Markdown), 1–2 sentences summarizing the story for cards, RSS, and meta description; max ~220 characters; must stand alone without reading the article; no leading "This article" filler.
16. primary_rubric: exactly one string — **"ai"** (ML, agents, models, search, avatars), **"hardware"** (chips, devices, GPUs, phones), **"open-source"** (licenses, Linux, community projects, Git), or **"other"** (legal/antitrust, streaming/media business, politics, security incidents, or anything that does not fit the three). This drives the site section URL (/rubric/…) for SEO.

17. JSON only: never put raw line breaks or tab characters inside string values — use \\n and \\t inside quotes (or emit one-line minified JSON).

Output a single JSON object ONLY (no markdown fences, no commentary):
{
  "title": "string",
  "slug": "string",
  "content_md": "string",
  "tags": ["string"],
  "dek": "string",
  "primary_rubric": "ai",
  "cover_type": "company",
  "cover_keyword": "string",
  "faq": [{"q": "string", "a": "string"}],
  "entities": [{"name": "string", "desc": "string"}],
  "sentiment": 7
}

--- INPUT ARTICLE ---
TITLE: ${title}

CONTENT:
${clipped}
`;

  const headers = {
    Authorization: `Bearer ${config.ai.openRouterKey}`,
    'Content-Type': 'application/json',
  };
  if (config.ai.openRouterHttpReferer) {
    headers['HTTP-Referer'] = config.ai.openRouterHttpReferer;
  }
  if (config.ai.openRouterAppTitle) {
    headers['X-Title'] = config.ai.openRouterAppTitle;
  }

  /** Opt-in: some models (e.g. openrouter/free) ignore or break on `response_format: json_object`. */
  const useJsonObjectFormat = process.env.OPENROUTER_JSON_OBJECT === '1';

  async function callOpenRouter(userPrompt, maxTokens) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.ai.openRouterModel,
        messages: [{ role: 'user', content: userPrompt }],
        ...(useJsonObjectFormat ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errText.slice(0, 400)}`);
    }

    const json = await response.json();
    const choice = json.choices?.[0];
    const rawResult = messageTextContent(choice?.message).trim();
    if (!rawResult) {
      const fr = choice?.finish_reason ?? '';
      const err = json.error?.message || '';
      const hint =
        'Check OPENROUTER_MODEL (free tiers often omit JSON); use a paid model or set OPENROUTER_JSON_OBJECT=0.';
      throw new Error(
        `OpenRouter: empty model response (finish_reason=${fr}${err ? `; ${err}` : ''}). ${hint}`
      );
    }

    const finishReason = String(choice?.finish_reason ?? '');
    const unwrapped = unwrapJsonContent(rawResult);
    const parsed = parseRewriterModelJson(unwrapped);
    const normalized = normalizeRewritten(parsed);
    return { normalized, finishReason };
  }

  try {
    const maxAttempts = rewriterMaxAttempts();
    let maxTokens = rewriterMaxTokens();
    let userPrompt = prompt;
    let finishReason = '';
    let normalized;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { normalized: n, finishReason: fr } = await callOpenRouter(userPrompt, maxTokens);
      normalized = n;
      finishReason = fr;

      if (finishReason === 'length') {
        console.warn(
          `[REWRITER] finish_reason=length (truncated). content_md chars=${normalized.content_md.length} slug=${normalized.slug} attempt=${attempt + 1}/${maxAttempts}`
        );
      }

      const needRetry = needsRewriterLengthRetry(clipped.length, normalized.content_md.length, finishReason);
      if (!needRetry || attempt >= maxAttempts - 1) {
        if (clipped.length > 2500 && normalized.content_md.length < 800) {
          console.warn(
            `[REWRITER] Short rewrite vs input: out=${normalized.content_md.length} in=${clipped.length} slug=${normalized.slug} — check model, max_tokens, or model behavior`
          );
        }
        return normalized;
      }

      console.warn(
        `[REWRITER] Retrying rewrite (${attempt + 2}/${maxAttempts}): out=${normalized.content_md.length} in=${clipped.length} finish_reason=${finishReason} max_tokens=${maxTokens} slug=${normalized.slug}`
      );
      userPrompt = prompt + rewriterRetrySuffix(normalized.content_md.length, clipped.length, finishReason);
      if (finishReason === 'length') {
        maxTokens = Math.min(32000, Math.floor(maxTokens * 1.55));
      } else {
        maxTokens = Math.min(32000, Math.floor(maxTokens * 1.12));
      }
    }
  } catch (err) {
    console.error('[REWRITER] Rewrite operation failed:', err.message);
    throw err;
  }
}
