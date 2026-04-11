import fetch from 'node-fetch';
import { config } from '../config.js';

function messageTextContent(message) {
  if (!message) return '';
  const c = message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * Bias the expander toward concrete real-world settings (no extra LLM call).
 * @param {{ title?: string, dek?: string, primary_rubric?: string, tags?: string[], cover_keyword?: string }} p
 */
function contextualSceneBias(p) {
  const title = String(p.title || '');
  const dek = String(p.dek || '');
  const kw = String(p.cover_keyword || '');
  const rubric = String(p.primary_rubric || '').toLowerCase();
  const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
  const blob = `${title} ${dek} ${kw} ${tags}`.toLowerCase();

  if (
    /\b(streaming|apple tv|netflix|disney\+|prime video|hulu|hbomax|series|television|tv show|binge|cord cutting)\b/.test(
      blob
    ) ||
    /\b(shows?\b|episodes?\b|season\b)/.test(blob)
  ) {
    return 'Topic looks like streaming / TV / series: prefer a real living room or media room with a wall-mounted TV (only soft screen glow, no readable UI or logos), warm evening lamp light, sofa — not a futuristic lab or hologram.';
  }
  if (rubric === 'security' || /\b(cyber|malware|breach|ransom|infosec|encryption|firewall)\b/.test(blob)) {
    return 'Security / infosec: prefer a real SOC or NOC with analysts, or a server room aisle — monitors show soft non-readable glow only, no charts, dashboards, or presentation graphics on screen; no sci-fi armor or holograms.';
  }
  if (rubric === 'energy' || /\b(battery|ev\b|solar|grid|wind farm|charger)\b/.test(blob)) {
    return 'Energy / cleantech: prefer real infrastructure (substation yard, solar array field, EV charging bay, factory floor) in daylight — not fantasy tech.';
  }
  if (rubric === 'hardware' || /\b(chip|gpu|phone launch|laptop|device)\b/.test(blob)) {
    return 'Hardware: prefer hands-on lab bench, teardown desk, or retail display with real devices — avoid generic “hacker neon”.';
  }
  return '';
}

/**
 * Turns rewriter `cover_keyword` + article context into one concrete English scene line for FLUX.
 * Skipped when `skipCoverSceneExpand`, when OPENROUTER_COVER_SCENE_EXPAND=0, or no API key.
 *
 * @param {{
 *   title?: string,
 *   dek?: string,
 *   primary_rubric?: string,
 *   tags?: string[],
 *   cover_keyword: string,
 *   content_md?: string,
 *   skipCoverSceneExpand?: boolean
 * }} ctx
 * @returns {Promise<string>}
 */
export async function resolveAbstractCoverSceneKeyword(ctx) {
  const rawKw = String(ctx.cover_keyword ?? '').replace(/\s+/g, ' ').trim();
  if (!rawKw) return rawKw;

  if (ctx.skipCoverSceneExpand === true) return rawKw;
  if (process.env.OPENROUTER_COVER_SCENE_EXPAND === '0') return rawKw;

  const key = config.ai.openRouterKey?.trim();
  if (!key) return rawKw;

  const flatBody = String(ctx.content_md || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

  const bias = contextualSceneBias({
    title: ctx.title,
    dek: ctx.dek,
    primary_rubric: ctx.primary_rubric,
    tags: ctx.tags,
    cover_keyword: rawKw
  });

  const model =
    process.env.OPENROUTER_COVER_SCENE_MODEL?.trim() ||
    process.env.OPENROUTER_PROMPT_MODEL?.trim() ||
    config.ai.openRouterModel ||
    'openrouter/auto';

  const user = `Write ONE English image prompt (max 42 words) for a news site hero photo.

Hard rules:
- Photorealistic editorial photograph, natural or believable indoor light, real world today — a real place and people or objects, **not** a diagram, chart, graph, infographic, slide deck, presentation layout, or “explainer” graphic.
- The scene MUST match the article (topic, industry, setting) — not a random tech stock image.
- **No words or letters** if possible: no signage text, no labels, no captions, no subtitles, no brand logos, no readable UI on screens (screens off, out of frame, or showing only soft abstract glow).
- No sci-fi, holograms, robots, neon cyberpunk, space, fantasy, or “futuristic” tropes unless the article title is literally about that fiction.
- Not a generic laptop-on-desk / coffee cup / anonymous open-plan office unless the story is truly about desk work.

Article title: ${String(ctx.title || 'unknown').slice(0, 200)}
Dek: ${String(ctx.dek || '').slice(0, 220)}
Primary section: ${String(ctx.primary_rubric || 'unknown')}
Tags: ${Array.isArray(ctx.tags) ? ctx.tags.slice(0, 12).join(', ') : ''}
Rewriter scene hint (respect and sharpen, you may replace vague parts): ${rawKw.slice(0, 320)}
${bias ? `Guidance: ${bias}` : ''}
Body snippet: ${flatBody || '(none)'}

Reply with ONLY the prompt line, no quotes.`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(config.ai.openRouterHttpReferer ? { 'HTTP-Referer': config.ai.openRouterHttpReferer } : {}),
        ...(config.ai.openRouterAppTitle ? { 'X-Title': config.ai.openRouterAppTitle } : {})
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (!res.ok) {
      const t = await res.text();
      console.warn('[cover-scene-expand] OpenRouter:', res.status, t.slice(0, 180));
      return rawKw;
    }

    const json = await res.json();
    const line = messageTextContent(json.choices?.[0]?.message)
      .trim()
      .replace(/^["']|["']$/g, '')
      .split('\n')[0]
      .trim();

    if (!line || line.length < 12) return rawKw;
    const out = line.slice(0, 500);
    if (out !== rawKw) {
      console.log(
        '[cover-scene-expand] expanded cover scene (%s → %s chars)',
        rawKw.length,
        out.length
      );
    }
    return out;
  } catch (e) {
    console.warn('[cover-scene-expand]', e?.message || e);
    return rawKw;
  }
}
