const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

const LOGOS = {
  'openai': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
  'anthropic': 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg',
  'google': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  'microsoft': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
  'nvidia': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg',
  'meta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/1024px-Meta_Platforms_Inc._logo.svg.png',
  'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
  'bitcoin': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg',
  'ethereum': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum_logo_2014.svg',
  'coinbase': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Coinbase_Wordmark.svg',
  'stripe': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
  'cloudflare': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.svg/1024px-Cloudflare_Logo.svg.png',
  'spacex': 'https://upload.wikimedia.org/wikipedia/commons/d/de/SpaceX_logo_black.svg',
  'oracle': 'https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg',
  'wikipedia': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg',
  'freebsd': 'https://upload.wikimedia.org/wikipedia/en/7/7b/FreeBSD_logo.svg',
  'algorand': 'https://upload.wikimedia.org/wikipedia/commons/7/74/Algorand%2C_2019.png',
  'tesla': 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : require('http');
    const req = lib.get(url, { headers: { 'User-Agent': 'SiliconFeed/1.0 (logo-collector)' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
  let ok = 0, skip = 0, fail = 0;
  for (const [key, url] of Object.entries(LOGOS)) {
    const ext = url.endsWith('.svg') ? 'svg' : 'png';
    const dest = path.join(LOGOS_DIR, `${key}.${ext}`);
    if (fs.existsSync(dest)) { skip++; console.log(`⏭ ${key}.${ext}`); continue; }
    try {
      await download(url, dest);
      ok++;
      console.log(`✅ ${key}.${ext}`);
    } catch (e) {
      fail++;
      console.log(`❌ ${key}: ${e.message}`);
    }
    // Rate limiting: wait 2s between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n📊 Done: ${ok} fetched, ${skip} skipped, ${fail} failed`);
}

main();
