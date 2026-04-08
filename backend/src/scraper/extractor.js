import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

/**
 * Highly efficient local extraction without running a headless browser.
 * Perfect for low-power Intel N100 servers.
 */
export async function extractArticleData(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = new JSDOM(html, { url });
    
    const reader = new Readability(doc.window.document);
    const parsed = reader.parse();

    if (!parsed || !parsed.textContent) {
      throw new Error("Readability failed to extract content.");
    }

    // Clean up content: strip excessive newlines
    let cleanText = parsed.textContent.replace(/\n\s*\n/g, '\n\n').trim();

    return {
      title: parsed.title,
      textContent: cleanText,
      excerpt: parsed.excerpt,
      siteName: parsed.siteName,
      length: cleanText.length
    };
  } catch (err) {
    console.error(`[EXTRACTOR] Error processing ${url}:`, err.message);
    throw err;
  }
}
