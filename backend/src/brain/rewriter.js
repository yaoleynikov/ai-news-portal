import fetch from 'node-fetch';
import { config } from '../config.js';

/**
 * Standardizes raw scraped text into high-quality IT/AI news.
 * Output is STRICT JSON corresponding to our Supabase schema.
 */
export async function rewriteArticle(title, content) {
  if (!config.ai.openRouterKey) {
    throw new Error('OPENROUTER_API_KEY is missing from environment.');
  }

  const prompt = `You are an elite Lead Tech Editor at a premium IT/AI news portal.
Your task is to take a raw scraped article and rewrite it into a highly engaging, professional news piece in Russian.
The tone should be modern, tech-savvy, and concise.

Rules:
1. Provide a click-worthy, SEO-optimized title.
2. The content MUST be valid Markdown.
3. CRITICAL SEO REQUIREMENT: Start the Markdown content with an H3 heading "### Главное:" followed by exactly 3 short bullet points summarizing the key takeaways.
4. Keep the main article under 5-6 paragraphs if possible. Strip fluff.
5. Extract 3-5 relevant tags.
6. Determine cover strategy:
   - company: If heavily tied to a specific big tech company AND its product (e.g., "Google" + "Gmail"), cover_keyword = "exact.product.domain.com" (e.g., gmail.com).
   - abstract: General tech/AI topics. cover_keyword = "a powerful visual metaphor in English".
7. PROPRIETARY DATA: Generate exactly 3 frequently asked questions (and answers) based on the text.
8. PROPRIETARY DATA: Extract entities (Name and Role/Description) of key people or organizations mentioned.
9. PROPRIETARY DATA: Provide a sentiment score from 1 (Extreme Negative) to 10 (Extreme Positive/Bullish).

Output strictly as a JSON object:
{
  "title": "string",
  "content_md": "string",
  "tags": ["string", "string"],
  "cover_type": "company|abstract",
  "cover_keyword": "string",
  "faq": [{"q": "string?", "a": "string"}],
  "entities": [{"name": "string", "desc": "string"}],
  "sentiment": 8
}

--- INPUT ARTICLE ---
TITLE: ${title}

CONTENT:
${content.substring(0, 8000)} // Truncated to avoid context limit overflow
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ai.openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.openRouterModel,
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const rawResult = json.choices[0].message.content;
    
    // Parse the JSON safely
    const parsed = JSON.parse(rawResult);
    return parsed;
  } catch (err) {
    console.error('[REWRITER] Rewrite operation failed:', err.message);
    throw err;
  }
}
