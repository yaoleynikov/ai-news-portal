import fetch from 'node-fetch';
import { config } from '../config.js';

/** OpenRouter / OpenAI-style message.content */
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
 * Turn editor Telegram note + article context into one English FLUX prompt line.
 * @param {{ title: string, contentPreview: string, editorNote: string }} p
 */
export async function buildFluxPromptFromEditorNote({ title, contentPreview, editorNote }) {
  const note = String(editorNote || '').trim();
  const flatPreview = String(contentPreview || '')
    .replace(/[#*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);

  if (!note) {
    return (
      flatPreview.slice(0, 200) ||
      'documentary photograph of a real technology industry setting with visible equipment or infrastructure, natural light'
    );
  }

  const key = config.ai.openRouterKey?.trim();
  if (!key) {
    return `${note}. Editorial context: ${String(title || '').slice(0, 120)}`.slice(0, 500);
  }

  const model =
    process.env.OPENROUTER_PROMPT_MODEL?.trim() || config.ai.openRouterModel || 'openrouter/auto';

  const user = `Write ONE English image prompt (max 40 words) for FLUX: photorealistic editorial/news photo, natural light, real-world present day. The scene must match the article title and snippet (industry, place, hardware) — not a random generic laptop-on-desk or coffee-cup stock shot unless the note is about desk work. No readable text, logos, or UI. No sci-fi or neon unless the editor note explicitly asks.

Article title: ${title || 'unknown'}
Article body snippet: ${flatPreview || '(none)'}

Editor note (follow this): ${note}

Reply with ONLY the prompt line, no quotes.`;

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
      temperature: 0.35,
      max_tokens: 180
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('[flux-prompt-from-note] OpenRouter:', res.status, errText.slice(0, 200));
    return `${note}. ${String(title || '').slice(0, 80)}`.slice(0, 500);
  }

  const json = await res.json();
  const line = messageTextContent(json.choices?.[0]?.message)
    .trim()
    .replace(/^["']|["']$/g, '')
    .split('\n')[0]
    .trim();

  if (!line) {
    return `${note}. ${String(title || '').slice(0, 80)}`.slice(0, 500);
  }
  return line.slice(0, 500);
}
