/**
 * Audit cover images for quality issues:
 * - SVG logos without fill → render white-on-white (blank)
 * - Logos lost on white background
 * - Very low brightness or contrast
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const rootDir = path.join(__dirname, '..');
const logosDir = path.join(rootDir, 'public', 'logos');
const coversDir = path.join(rootDir, 'public', 'covers');

// ─── Check & fix SVG logos that might render white-on-white ────────────────────
function fixSvgFill(svgPath, color = '#1a1a1a') {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const paths = svg.match(/<path[^>]*\/?>/g) || [];
  const needsFill = paths.some(p => !/fill\s*=/.test(p));
  
  // Check if SVG already has colors (style, stroke, etc.)
  const hasColors = /fill\s*=\s*["']#[0-9a-fA-F]/.test(svg) ||
                    /style\s*=\s*["'][^"']*fill\s*:/.test(svg);
  
  if (!needsFill || hasColors) return false;

  const fixed = svg.replace(
    /(<path\b)([^>]*?)(\/?>)/g,
    (m, open, attrs, close) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `${open} fill="${color}"${attrs}${close}`;
    }
  );
  fs.writeFileSync(svgPath, fixed, 'utf8');
  console.log(`  FIXED: ${path.basename(svgPath)} → added fill="${color}"`);
  return true;
}

// ─── Test render an SVG logo and verify it's not blank ─────────────────────────
async function verifyLogoRenders(key, buffer, isSvg) {
  try {
    const meta = await sharp(buffer).metadata();
    
    // For SVG, check if it actually has visible content
    if (isSvg) {
      // Render to small PNG to check brightness
      const small = await sharp(buffer).resize(100, 100).raw().toBuffer();
      let sum = 0;
      for (let i = 0; i < small.length; i += 4) {
        sum += (small[i] + small[i+1] + small[i+2]) / 3;
      }
      const avg = sum / (small.length / 4);
      
      // If average pixel is ~255 (white), the logo is blank/white-on-transparent
      if (avg > 250) {
        console.log(`  WARN: ${key} renders as blank/white (avg brightness: ${avg.toFixed(0)})`);
        return false;
      }
      
      // Check contrast (variance)
      const mean = avg;
      let variance = 0;
      for (let i = 0; i < small.length; i += 4) {
        const px = (small[i] + small[i+1] + small[i+2]) / 3;
        variance += Math.pow(px - mean, 2);
      }
      variance = variance / (small.length / 4);
      
      if (variance < 50) {
        console.log(`  WARN: ${key} very low contrast (variance: ${variance.toFixed(0)})`);
        return false;
      }

      console.log(`  OK: ${key} (${meta.width}x${meta.height}, avg:${avg.toFixed(0)}, var:${variance.toFixed(0)})`);
      return true;
    }
    
    // For PNG - check it's not tiny
    if (meta.width < 32 || meta.height < 32) {
      console.log(`  WARN: ${key} too small (${meta.width}x${meta.height})`);
      return false;
    }
    
    return true;
  } catch (e) {
    console.log(`  ERR: ${key} - ${e.message.substring(0, 100)}`);
    return false;
  }
}

// ─── Check cover image quality ─────────────────────────────────────────────────
async function checkCover(filePath, slug) {
  if (!fs.existsSync(filePath)) return { slug, ok: false, missing: true };
  
  const info = await sharp(filePath).metadata();
  return { slug, ok: true, width: info.width, height: info.height };
}

// ─── Re-render cover from logo at 80% width ────────────────────────────────────
async function renderCoverFromLogo(logoBuffer, isSvg, coverPath) {
  // Get logo dimensions
  const logoSvg = isSvg
    ? logoBuffer  // SVG stays as-is
    : await sharp(logoBuffer).toBuffer();

  const mime = isSvg ? 'svg+xml' : 'png';
  const dataUri = `data:image/${mime};base64,${logoBuffer.toString('base64')}`;

  // Logo at 80% of 1200 = 960px wide, centered
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="35%" stop-color="#8b5cf6"/>
      <stop offset="65%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="100"/></filter>
  </defs>
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="5" fill="url(#bar)"/>
  <!-- Background: blurred, enlarged, subtle -->
  <image href="${dataUri}" x="-800" y="-1400" width="2800" height="2800"
         opacity="0.2" filter="url(#blur)" preserveAspectRatio="xMidYMid meet"/>
  <!-- Logo: 80% width (960px), centered at y=150 to give breathing room -->
  <image href="${dataUri}" x="120" y="81" width="960" height="468"
         opacity="1" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
  const png = resvg.render().asPng();
  await sharp(png).jpeg({ quality: 90 }).toFile(coverPath);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const mode = process.argv[2] || 'check';

  // Step 1: Fix SVG logos
  console.log('━━ SVG Logo Audit ━━');
  let fixed = 0;
  const svgFiles = fs.readdirSync(logosDir).filter(f => f.endsWith('.svg'));
  for (const f of svgFiles) {
    if (fixSvgFill(path.join(logosDir, f))) fixed++;
  }
  if (fixed === 0) console.log('  All SVG logos have fill attributes ✓');
  else console.log(`  Fixed ${fixed} SVG logo(s)`);

  // Step 2: Verify all logos render properly
  console.log('\n━━ Logo Render Check ━━');
  const { Resvg } = require('@resvg/resvg-js');
  
  for (const f of fs.readdirSync(logosDir)) {
    const ext = f.split('.').pop().toLowerCase();
    if (!['svg','png','jpg','jpeg','webp'].includes(ext)) continue;
    
    const key = f.split('.').slice(0, -1).join('.');
    const buf = fs.readFileSync(path.join(logosDir, f));
    await verifyLogoRenders(key, buf, ext === 'svg');
  }

  // Step 3: Audit covers
  console.log('\n━━ Cover Quality Check ━━');
  const covers = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg'));
  const checks = [];
  
  for (const cover of covers) {
    const slug = cover.replace(/\.jpg$/, '');
    checks.push(await checkCover(path.join(coversDir, cover), slug));
  }

  const missing = checks.filter(c => c.missing);
  const present = checks.filter(c => !c.missing);
  
  console.log(`  Present: ${present.length}, Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`  Missing: ${missing.map(c => c.slug).join(', ')}`);
  }

  // Step 4: Re-render mode
  if (mode === 'rebuild') {
    console.log('\n━━ Rebuilding Covers ━━');
    // Re-run generate with new 80% logo size
    require(path.join(__dirname, 'generate-covers'));
  }
})().catch(e => console.error('Error:', e));
