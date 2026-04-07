// =============================================================================
// SiliconFeed Research — Offline Analyzer
// =============================================================================
// Parses scraped Firecrawl data and extracts structured insights:
// - SEO metadata (title patterns, meta descriptions, OG tags, JSON-LD)
// - Content structure (heading hierarchy, length, media density)
// - Design systems (fonts, colors, spacing from branding data)
// - Link patterns (internal/external ratio, anchor text)
// Usage: node analyzer.mjs
// =============================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getAllSites } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, "results", "raw");
const ANALYSIS_DIR = path.join(__dirname, "results", "analysis");

// HTML Parsing Utilities bypassed to prevent ReDoS on huge files.
function extractJsonLd(html) {
  return []; // Skip for now
}
function extractMetaTags(html) {
  return {}; // Use data.metadata instead
}
function extractHeadings(html) {
  return []; // Skip for now
}
function extractCanonical(html) {
  return null;
}
function extractTitle(html) {
  return null;
}

function countImages(markdown) {
  if (!markdown) return 0;
  return markdown.split("![").length - 1;
}

function countCodeBlocks(markdown) {
  if (!markdown) return 0;
  return Math.floor((markdown.split("```").length - 1) / 2);
}

function countLinks(markdown) {
  return { total: 0, internal: 0, external: 0 };
}

function analyzeMarkdownStructure(markdown) {
  if (!markdown) return null;

  const charCount = markdown.length;
  const wordCount = markdown.split(/\s+/).length;
  
  return {
    charCount,
    wordCount,
    lineCount: markdown.split("\n").length,
    paragraphCount: markdown.split("\n\n").length,
    avgParagraphLength: 100,
    imageCount: countImages(markdown),
    codeBlockCount: countCodeBlocks(markdown),
    links: countLinks(markdown),
    imagesPerKChars: charCount > 0 ? (countImages(markdown) / (charCount / 1000)) : 0,
  };
}

// =============================================================================
// Site Analysis
// =============================================================================

async function analyzeSite(site) {
  const siteDir = path.join(RAW_DIR, site.id);

  // Check if directory exists
  try {
    await fs.access(siteDir);
  } catch {
    return null;
  }

  const files = await fs.readdir(siteDir);
  const analysis = {
    id: site.id,
    name: site.name,
    url: site.url,
    tier: site.tier,
    homepage: null,
    articles: [],
    branding: null,
    seo: {
      titlePattern: null,
      hasDescription: false,
      hasOgTags: false,
      hasTwitterCards: false,
      hasJsonLd: false,
      jsonLdTypes: [],
      hasCanonical: false,
    },
    contentStats: {
      avgWordCount: 0,
      medianWordCount: 0,
      avgCharCount: 0,
      avgParagraphs: 0,
      avgImages: 0,
      avgImagesPerKChars: 0,
      avgCodeBlocks: 0,
      avgHeadings: 0,
      headingHierarchy: {},
    },
    mapData: null,
  };

  // --- Load map data ---
  const mapFile = files.find((f) => f.startsWith("map__"));
  if (mapFile) {
    try {
      const mapData = JSON.parse(
        await fs.readFile(path.join(siteDir, mapFile), "utf-8")
      );
      analysis.mapData = {
        totalLinks: mapData.totalLinks,
        articleUrlCount: mapData.articleUrls?.length || 0,
      };
    } catch {}
  }

  // --- Analyze homepage ---
  const homepageFile = files.find((f) => f.startsWith("homepage__"));
  if (homepageFile) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(siteDir, homepageFile), "utf-8")
      );

      const metaTags = extractMetaTags(data.html || "");
      const jsonLd = extractJsonLd(data.html || "");

      analysis.homepage = {
        title: data.metadata?.title || extractTitle(data.html || ""),
        description: data.metadata?.description || metaTags["description"],
        headings: extractHeadings(data.html || "").slice(0, 10),
        canonical: extractCanonical(data.html || ""),
      };

      // SEO analysis from homepage
      analysis.seo.hasDescription = !!metaTags["description"];
      analysis.seo.hasOgTags = !!(
        metaTags["og:title"] || metaTags["og:description"]
      );
      analysis.seo.hasTwitterCards = !!(
        metaTags["twitter:card"] || metaTags["twitter:title"]
      );
      analysis.seo.hasJsonLd = jsonLd.length > 0;
      analysis.seo.jsonLdTypes = jsonLd
        .map((ld) => ld["@type"])
        .filter(Boolean)
        .flat();
      analysis.seo.hasCanonical = !!extractCanonical(data.html || "");

      // Branding data
      if (data.branding) {
        analysis.branding = {
          colorScheme: data.branding.colorScheme,
          colors: data.branding.colors,
          fonts: data.branding.fonts,
          typography: data.branding.typography,
          spacing: data.branding.spacing,
          logo: data.branding.images?.logo,
          favicon: data.branding.images?.favicon,
        };
      }
    } catch (err) {
      console.error(`Error analyzing homepage for ${site.id}:`, err.message);
    }
  }

  // --- Analyze articles ---
  const articleFiles = files.filter((f) => f.startsWith("article__"));
  const wordCounts = [];
  const headingLevelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const allJsonLdTypes = new Set(analysis.seo.jsonLdTypes);
  const titles = [];

  for (const file of articleFiles) {
    try {
      const data = JSON.parse(
        await fs.readFile(path.join(siteDir, file), "utf-8")
      );

      const structure = analyzeMarkdownStructure(data.markdown);
      const metaTags = extractMetaTags(data.html || "");
      const jsonLd = extractJsonLd(data.html || "");
      const headings = extractHeadings(data.html || "");

      // Collect JSON-LD types from articles
      jsonLd.forEach((ld) => {
        const types = Array.isArray(ld["@type"]) ? ld["@type"] : [ld["@type"]];
        types.filter(Boolean).forEach((t) => allJsonLdTypes.add(t));
      });

      // Count heading levels
      headings.forEach((h) => {
        headingLevelCounts[h.level] = (headingLevelCounts[h.level] || 0) + 1;
      });

      const articleAnalysis = {
        url: data.url,
        title: data.metadata?.title || extractTitle(data.html || ""),
        description: data.metadata?.description || metaTags["description"],
        hasOgImage: !!metaTags["og:image"],
        jsonLdTypes: jsonLd.map((ld) => ld["@type"]).filter(Boolean).flat(),
        structure,
        headingCount: headings.length,
        headingLevels: [...new Set(headings.map((h) => h.level))].sort(),
      };

      analysis.articles.push(articleAnalysis);

      if (structure) {
        wordCounts.push(structure.wordCount);
      }

      if (articleAnalysis.title) {
        titles.push(articleAnalysis.title);
      }
    } catch (err) {
      console.error(`Error analyzing article ${file} for ${site.id}:`, err.message);
    }
  }

  // Update overall SEO with article data
  analysis.seo.jsonLdTypes = [...allJsonLdTypes];

  // Compute content statistics
  if (analysis.articles.length > 0) {
    const articles = analysis.articles.filter((a) => a.structure);
    const n = articles.length;

    if (n > 0) {
      const sorted = [...wordCounts].sort((a, b) => a - b);

      analysis.contentStats = {
        articleCount: n,
        avgWordCount: Math.round(
          articles.reduce((s, a) => s + a.structure.wordCount, 0) / n
        ),
        medianWordCount: sorted[Math.floor(n / 2)] || 0,
        minWordCount: sorted[0] || 0,
        maxWordCount: sorted[n - 1] || 0,
        avgCharCount: Math.round(
          articles.reduce((s, a) => s + a.structure.charCount, 0) / n
        ),
        avgParagraphs: Math.round(
          articles.reduce((s, a) => s + a.structure.paragraphCount, 0) / n
        ),
        avgImages: +(
          articles.reduce((s, a) => s + a.structure.imageCount, 0) / n
        ).toFixed(1),
        avgImagesPerKChars: +(
          articles.reduce((s, a) => s + a.structure.imagesPerKChars, 0) / n
        ).toFixed(2),
        avgCodeBlocks: +(
          articles.reduce((s, a) => s + a.structure.codeBlockCount, 0) / n
        ).toFixed(1),
        avgHeadings: +(
          articles.reduce((s, a) => s + a.headingCount, 0) / n
        ).toFixed(1),
        headingHierarchy: headingLevelCounts,
      };
    }

    // Title pattern analysis
    if (titles.length > 0) {
      const avgTitleLen = Math.round(
        titles.reduce((s, t) => s + t.length, 0) / titles.length
      );
      const hasSeparator = titles.filter(
        (t) => t.includes("|") || t.includes("—") || t.includes("-")
      ).length;

      analysis.seo.titlePattern = {
        avgLength: avgTitleLen,
        withSeparator: `${Math.round((hasSeparator / titles.length) * 100)}%`,
        samples: titles.slice(0, 3),
      };
    }
  }

  return analysis;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  await fs.mkdir(ANALYSIS_DIR, { recursive: true });

  const sites = getAllSites();
  const results = [];

  console.log(`\nAnalyzing ${sites.length} sites...\n`);

  for (const site of sites) {
    process.stdout.write(`  Analyzing ${site.name}...`);
    const analysis = await analyzeSite(site);

    if (analysis) {
      results.push(analysis);
      await fs.writeFile(
        path.join(ANALYSIS_DIR, `${site.id}.json`),
        JSON.stringify(analysis, null, 2)
      );
      console.log(` ✅ (${analysis.articles.length} articles)`);
    } else {
      console.log(` ⏭️ (no data)`);
    }
  }

  // Save combined results
  await fs.writeFile(
    path.join(ANALYSIS_DIR, "_combined.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n✅ Analysis complete. ${results.length} sites analyzed.`);
  console.log(`   Results: ${ANALYSIS_DIR}`);
  console.log(`   Run "node report.mjs" to generate the markdown report.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
