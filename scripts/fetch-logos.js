const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { URL } = require('url');

const BRAVE_KEY = 'BSAuzT5f6qJnM1FNts_-LYkacF6yuKV';
const logosDir = path.join(__dirname, '..', 'public', 'logos');

// Companies that need fresh logos
const companies = [
  'openai', 'anthropic', 'google', 'microsoft', 'nvidia',
  'meta', 'amazon', 'bitcoin', 'ethereum', 'coinbase',
  'stripe', 'cloudflare', 'spacex', 'oracle', 'wikipedia',
  'freebsd', 'algorand', 'tesla', 'brave', 'duckduckgo',
  'x', 'twitter', 'tiktok', 'instagram', 'youtube', 'apple',
  'samsung', 'intel', 'amd', 'qualcomm', 'arm', 'tencent',
  'baidu', 'bytedance', 'openrouter', 'vercel', 'cloudflare',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

async function braveSearchImages(query) {
  const url = new URL('https://api.search.brave.com/res/v1/images/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '10');
  url.searchParams.set('search_type', 'images');

  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'X-Subscription-Token': BRAVE_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks));
          resolve(json.results || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function isTransparentOrGoodType(headers) {
  const contentType = headers['content-type'] || '';
  return contentType.includes('png') || contentType.includes('svg') || contentType.includes('webp');
}

function isSquareOrIcon(width, height) {
  if (!width || !height) return false;
  const ratio = Math.min(width, height) / Math.max(width, height);
  return ratio >= 0.5 && width >= 128 && height >= 128 && width <= 2000 && height <= 2000;
}

async function downloadLogo(company, query) {
  const existingPng = path.join(logosDir, company + '.png');
  const existingSvg = path.join(logosDir, company + '.svg');
  if (fs.existsSync(existingSvg) || fs.existsSync(existingPng)) {
    console.log(`  SKIP: ${company} (already exists)`);
    return;
  }

  console.log(`  Searching: ${query}`);
  const results = await braveSearchImages(query);

  for (const img of results) {
    const props = img.properties;
    if (!props || !props.url || !props.url.startsWith('https')) continue;

    // Skip thumbnails
    if (props.url.includes('brave.com') || props.url.includes('imgs.search.brave.com')) continue;

    const w = props.width || 0;
    const h = props.height || 0;
    const goodShape = isSquareOrIcon(w, h);
    const isGoodType = isTransparentOrGoodType({ 'content-type': img.source?.includes('.png') ? 'image/png' : 
                                                   img.source?.includes('.svg') ? 'image/svg+xml' : '' });

    try {
      const response = await fetchUrl(props.url);
      if (response.statusCode !== 200 || response.data.length < 500 || response.data.length > 5 * 1024 * 1024) continue;

      // Detect type from content-type header or URL
      const ct = response.headers['content-type'] || '';
      let ext, filename;

      if (ct.includes('svg') || props.url.endsWith('.svg')) {
        ext = '.svg';
        filename = company + ext;
      } else if (ct.includes('png') || props.url.endsWith('.png')) {
        ext = '.png';
        filename = company + ext;
      } else {
        // Convert to PNG via sharp
        ext = '.png';
        filename = company + ext;
        const converted = await sharp(response.data).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        fs.writeFileSync(path.join(logosDir, filename), converted);
        console.log(`  SAVED: ${filename} (${converted.length} bytes) from ${query}`);
        return;
      }

      fs.writeFileSync(path.join(logosDir, filename), response.data);
      console.log(`  SAVED: ${filename} (${response.data.length} bytes) from ${query}`);
      return;
    } catch (e) {
      // Continue to next result
    }
  }
  console.log(`  FAILED: ${company} - no download succeeded`);
}

async function main() {
  // Download missing company logos
  const logoMap = {
    'baidu': 'Baidu logo transparent png',
    'startup': 'VC seed funding startup investment logo icon',
  };

  for (const [company, query] of Object.entries(logoMap)) {
    try {
      await downloadLogo(company, query);
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`  ERROR: ${company}: ${e.message}`);
    }
  }
}

main().catch(e => console.error(e));
