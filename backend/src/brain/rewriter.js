import fetch from 'node-fetch';
import { config } from '../config.js';
import { finalizeArticleSlug } from '../lib/slug.js';

function rewriterMaxTokens() {
  const n = parseInt(process.env.REWRITER_MAX_TOKENS || '', 10);
  if (Number.isFinite(n) && n >= 1024 && n <= 32000) return n;
  return 10240;
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
 * @param {unknown} parsed
 */
export function normalizeRewritten(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Rewriter: model returned non-object JSON');
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const content_md = typeof o.content_md === 'string' ? o.content_md.trim() : '';
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
      : 'futuristic technology innovation';
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

  return {
    title,
    slug,
    content_md,
    tags,
    cover_type,
    cover_keyword,
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
3. CRITICAL: Start the Markdown with an H3 heading "### At a glance:" then exactly 3 bullet lines (- item) with the key takeaways.
4. After that, use ## for 4–6 section headings. Each section should have 2–4 full paragraphs (several sentences each): context, details, implications for users or the market, and — where relevant — brief comparison or outlook. When the source is rich, target about 12–20 substantial paragraphs in total across sections; when the source is short, still aim for at least 8–10 paragraphs (do not pad with empty phrases).
5. Do not repeat the same fact in different words across sections; add new angles (how it works, who it affects, limitations, timeline) instead.
6. Extract 3–6 concise tags in English.
7. Cover strategy:
   - company: Only if the story is clearly about one well-known tech brand/product. cover_keyword MUST be a real domain like "openai.com" or "google.com" (no paths).
   - abstract: For general or multi-vendor topics. cover_keyword = short English metaphor phrase (5–12 words) for a photorealistic scene, no brand names.
8. slug: one unique URL slug in English, lowercase kebab-case (a-z, 0-9, hyphens), 3–60 chars, no year spam; derived from the topic (for /news/[slug]).
9. Exactly 3 FAQ items (q/a in English), grounded in the article; answers should be informative (3–6 sentences each), not one-liners.
10. entities: 4–8 notable companies, products, or people from the text (name + one-line description in English).
11. sentiment: integer 1–10 (market/tech tone for investors/readers).

Output a single JSON object ONLY (no markdown fences, no commentary):
{
  "title": "string",
  "slug": "string",
  "content_md": "string",
  "tags": ["string"],
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

  try {
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.ai.openRouterModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        ...(useJsonObjectFormat ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.5,
        max_tokens: rewriterMaxTokens()
      })
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

    const unwrapped = unwrapJsonContent(rawResult);
    const parsed = JSON.parse(unwrapped);
    return normalizeRewritten(parsed);
  } catch (err) {
    console.error('[REWRITER] Rewrite operation failed:', err.message);
    throw err;
  }
}
