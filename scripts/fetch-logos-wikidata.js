// fetch-logos-wikidata.js — Download logos from Wikidata
const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

const PRODUCTS = {
  'openai': 'Q68830822',
  'anthropic': 'Q109601997',
  'google': 'Q95',
  'microsoft': 'Q2283',
  'nvidia': 'Q182496',
  'meta': 'Q380935',
  'amazon': 'Q3884',
  'bitcoin': 'Q18914',
  'ethereum': 'Q708943',
  'coinbase': 'Q29255811',
  'stripe': 'Q35400525',
  'cloudflare': 'Q10846393',
  'spacex': 'Q193701',
  'oracle': 'Q19900',
  'wikipedia': 'Q52',
  'freebsd': 'Q293431',
  'algorand': 'Q60791705',
  'tesla': 'Q478214',
  'marvell': 'Q2431267',
};

async function getLogoFilename(qId) {
  return new Promise(resolve => {
    https.get(`https://www.wikidata.org/wiki/Special:EntityData/${qId}.json`,
      { headers: { 'User-Agent': 'SiliconFeed/1.0' }, timeout: 10000 }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            const entity = j.entities?.[qId];
            const logo = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
            resolve(logo || null);
          } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
  });
}

function getDownloadUrl(filename) {
  const a = filename[0];
  const ab = filename.slice(0, 2);
  return `https://upload.wikimedia.org/wikipedia/commons/${a}/${ab}/${filename}`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SiliconFeed/1.0' }, timeout: 10000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const keyToQId = {};
  for (const [key, qId] of Object.entries(PRODUCTS)) keyToQId[key] = qId;

  // Batch fetch from Wikidata
  const logoMap = {};
  const qIds = [...new Set(Object.values(PRODUCTS))];

  for (const qId of qIds) {
    await new Promise(r => setTimeout(r, 1500));
    const filename = await getLogoFilename(qId);
    if (filename) {
      logoMap[qId] = filename;
      console.log(`  📋 ${qId} → "${filename}"`);
    }
  }

  let ok = 0, skip = 0, fail = 0;
  for (const [key, qId] of Object.entries(PRODUCTS)) {
    const filename = logoMap[qId];
    if (!filename) { console.log(`  ⚠️ ${key}: no logo in Wikidata`); continue; }

    const ext = filename.endsWith('.svg') ? 'svg' : 'png';
    const dest = path.join(LOGOS_DIR, `${key}.${ext}`);
    if (fs.existsSync(dest)) { skip++; continue; }

    try {
      await download(getDownloadUrl(filename), dest);
      ok++;
      console.log(`  ✅ ${key}.${ext} (${fs.statSync(dest).size} bytes)`);
    } catch (e) {
      fail++;
      console.log(`  ❌ ${key}: ${e.message}`);
    }
  }

  console.log(`\n📊 ${ok} fetched, ${skip} skipped, ${fail} failed`);
}

main();
