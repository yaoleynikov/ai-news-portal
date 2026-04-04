// fetch-logos-wikimedia.js — Download logos directly from Wikimedia Commons
const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

// Direct Wikimedia Commons filenames (verified)
const LOGOS = {
  'openai': 'OpenAI_Logo.svg',
  'anthropic': 'Anthropic_logo.svg',
  'google': 'Google_2015_logo.svg',
  'microsoft': 'Microsoft_logo_(2012).svg',
  'nvidia': 'Nvidia_logo.svg',
  'meta': 'Meta_Platforms_Inc._logo.svg',
  'amazon': 'Amazon_logo.svg',
  'bitcoin': 'Bitcoin_Simple_Logo.svg',
  'ethereum': 'Ethereum_logo_2014.svg',
  'coinbase': 'Coinbase_2021_logo.svg',
  'stripe': 'Stripe_Logo,_revised_2016.svg',
  'cloudflare': 'Cloudflare_Logo.jpg',
  'spacex': 'SpaceX_logo_black.svg',
  'oracle': 'Oracle_logo.svg',
  'wikipedia': 'Wikipedia-logo-v2.svg',
  'freebsd': 'FreeBSD_logo.svg',
  'algorand': 'Algorand,_2019.png',
  'tesla': 'Tesla_Motors.svg',
};

function getDownloadUrl(filename) {
  const firstChar = filename[0];
  const firstTwo = filename.slice(0, 2);
  return `https://upload.wikimedia.org/wikipedia/commons/${firstChar}/${firstTwo}/${filename}`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SiliconFeed/1.0' }, timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(file.path); });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  let ok = 0, skip = 0, fail = 0;
  for (const [key, filename] of Object.entries(LOGOS)) {
    const ext = filename.endsWith('.svg') ? 'svg' : filename.endsWith('.png') ? 'png' : 'jpg';
    const saveName = `${key}.${ext}`;
    const dest = path.join(LOGOS_DIR, saveName);

    if (fs.existsSync(dest)) {
      skip++;
      console.log(`⏭ ${saveName}`);
      continue;
    }

    const url = getDownloadUrl(filename);
    try {
      await new Promise(r => setTimeout(r, 3000)); // 3s rate limit
      await download(url, dest);
      const size = fs.statSync(dest).size;
      ok++;
      console.log(`✅ ${saveName} (${size} bytes)`);
    } catch (e) {
      fail++;
      console.log(`❌ ${saveName}: ${e.message}`);
    }
  }

  console.log(`\n📊 ${ok} fetched, ${skip} skipped, ${fail} failed`);
}

main();
