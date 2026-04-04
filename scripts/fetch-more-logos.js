const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

const LOGOS = {
  'meta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/1024px-Meta_Platforms_Inc._logo.svg.png',
  'ethereum': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ethereum_logo_2014.svg/1024px-Ethereum_logo_2014.svg.png',
  'freebsd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/FreeBSD_logo.svg/1024px-FreeBSD_logo.svg.png',
  'algorand': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Algorand%2C_2019.png/1024px-Algorand%2C_2019.png',
  'spacex': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/SpaceX_logo_black.svg/1024px-SpaceX_logo_black.svg.png',
  'cloudflare': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.svg/1024px-Cloudflare_Logo.svg.png',
  'coinbase': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Coinbase_Wordmark.svg/1024px-Coinbase_Wordmark.svg.png',
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
    const ext = url.endsWith('.png') ? 'png' : 'svg';
    const dest = path.join(LOGOS_DIR, `${key}.${ext}`);
    if (fs.existsSync(dest)) { skip++; console.log(`⏭ ${key}.${ext}`); continue; }
    try {
      await new Promise(r => setTimeout(r, 2500));
      await download(url, dest);
      ok++;
      console.log(`✅ ${key}.${ext} (${fs.statSync(dest).size} bytes)`);
    } catch (e) {
      fail++;
      console.log(`❌ ${key}: ${e.message}`);
    }
  }
  console.log(`\n📊 ${ok} fetched, ${skip} skipped, ${fail} failed`);
}

main();
