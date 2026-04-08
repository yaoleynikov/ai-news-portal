// =============================================================================
// SiliconFeed Research — Firecrawl Scraper
// =============================================================================
// Sequential scraper that maps and scrapes competitor sites.
// Resume-capable: skips already scraped URLs.
// Usage: node scraper.mjs [--tier 1|2|3|all] [--site siteId]
// =============================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import FirecrawlApp from "@mendable/firecrawl-js";
import {
  FIRECRAWL_API_KEY,
  REQUEST_DELAY_MS,
  SCRAPE_TIMEOUT_MS,
  MAP_LIMIT,
  getAllSites,
  estimateCredits,
} from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "results", "raw");
const PROGRESS_FILE = path.join(__dirname, "results", "progress.json");

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const icons = { info: "ℹ️", ok: "✅", warn: "⚠️", err: "❌", skip: "⏭️" };
  console.log(`[${ts}] ${icons[level] || "•"} ${msg}`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { scraped: {}, mapped: {}, errors: [], creditsUsed: 0 };
  }
}

async function saveProgress(progress) {
  await ensureDir(path.dirname(PROGRESS_FILE));
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function saveResult(siteId, pageType, slug, data) {
  const siteDir = path.join(RESULTS_DIR, siteId);
  await ensureDir(siteDir);
  const filename = `${pageType}__${slug}.json`;
  await fs.writeFile(
    path.join(siteDir, filename),
    JSON.stringify(data, null, 2)
  );
}

function slugify(url) {
  return url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
}

// =============================================================================
// Firecrawl Operations
// =============================================================================

async function mapSite(site) {
  log("info", `Mapping ${site.name} (${site.url})...`);
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: site.url,
        limit: MAP_LIMIT,
        includeSubdomains: false,
        ignoreQueryParameters: true,
      }),
    });

    const result = await response.json();

    if (result.success && result.links) {
      log("ok", `Mapped ${site.name}: ${result.links.length} URLs found`);
      return result.links.map((l) =>
        typeof l === "string" ? { url: l } : l
      );
    } else {
      log("warn", `Map returned unexpected format for ${site.name}: ${JSON.stringify(result).slice(0, 200)}`);
      return [];
    }
  } catch (err) {
    log("err", `Map failed for ${site.name}: ${err.message}`);
    return [];
  }
}

async function scrapePage(app, url, options = {}) {
  const { onlyMainContent = true, includeBranding = false } = options;

  const formats = ["markdown", "html", "links"];
  if (includeBranding) {
    formats.push("branding");
  }

  try {
    const result = await app.scrapeUrl(url, {
      formats,
      onlyMainContent,
      timeout: SCRAPE_TIMEOUT_MS,
      removeBase64Images: true,
      blockAds: true,
    });

    if (result.success !== false) {
      return result;
    }
    log("warn", `Scrape returned failure for ${url}`);
    return null;
  } catch (err) {
    log("err", `Scrape failed for ${url}: ${err.message}`);
    return null;
  }
}

// =============================================================================
// Filter article URLs from map results
// =============================================================================

function filterArticleUrls(links, site) {
  const seen = new Set();
  const articles = [];

  for (const link of links) {
    const url = typeof link === "string" ? link : link.url;
    if (!url) continue;

    // Skip if already seen
    if (seen.has(url)) continue;
    seen.add(url);

    // Skip non-article pages
    if (
      url.includes("/tag/") ||
      url.includes("/category/") ||
      url.includes("/author/") ||
      url.includes("/page/") ||
      url.includes("/search") ||
      url.includes("/login") ||
      url.includes("/signup") ||
      url.includes("/privacy") ||
      url.includes("/terms") ||
      url.includes("/about") ||
      url.includes("/contact") ||
      url.includes("/feed") ||
      url.includes("/rss")
    ) {
      continue;
    }

    // Match article pattern if defined
    if (site.articlePattern && site.articlePattern.test(url)) {
      articles.push(url);
    }
  }

  // Return up to maxArticles, preferring the most recent (usually first in sitemap)
  return articles.slice(0, site.maxArticles);
}

// =============================================================================
// Main Pipeline
// =============================================================================

async function processSite(app, site, progress) {
  const siteDir = path.join(RESULTS_DIR, site.id);
  await ensureDir(siteDir);

  log("info", `\n${"=".repeat(60)}`);
  log(
    "info",
    `Processing [Tier ${site.tier}] ${site.name} (${site.url})`
  );
  log("info", `${"=".repeat(60)}`);

  // --- Step 1: Map the site ---
  let articleUrls = [];

  if (progress.mapped[site.id]) {
    log("skip", `Map already done for ${site.name}, loading cached URLs`);
    try {
      const cached = JSON.parse(
        await fs.readFile(path.join(siteDir, "map__urls.json"), "utf-8")
      );
      articleUrls = cached.articleUrls || [];
    } catch {
      log("warn", `Could not load cached map for ${site.name}, re-mapping`);
      progress.mapped[site.id] = false;
    }
  }

  if (!progress.mapped[site.id]) {
    const allLinks = await mapSite(site);
    progress.creditsUsed += 1;
    await sleep(REQUEST_DELAY_MS);

    articleUrls = filterArticleUrls(allLinks, site);

    // If pattern matching found nothing, try taking URLs that look like articles
    if (articleUrls.length === 0) {
      log("warn", `Pattern matched 0 articles for ${site.name}, using heuristic`);
      const heuristic = allLinks
        .map((l) => (typeof l === "string" ? l : l.url))
        .filter((u) => {
          if (!u) return false;
          const parts = new URL(u).pathname.split("/").filter(Boolean);
          // Articles typically have 2+ path segments and no common non-article segments
          return parts.length >= 2 && !/^(tag|category|author|page|search|about|contact|privacy|terms)$/i.test(parts[0]);
        });
      articleUrls = heuristic.slice(0, site.maxArticles);
    }

    // Save map results
    await saveResult(site.id, "map", "urls", {
      totalLinks: allLinks.length,
      articleUrls,
      allLinks: allLinks.slice(0, 200), // Keep first 200 for reference
    });

    progress.mapped[site.id] = true;
    await saveProgress(progress);

    log("ok", `Found ${articleUrls.length} article URLs for ${site.name}`);
  }

  // --- Step 2: Scrape homepage (with branding) ---
  const homepageKey = `${site.id}__homepage`;

  if (progress.scraped[homepageKey]) {
    log("skip", `Homepage already scraped for ${site.name}`);
  } else {
    log("info", `Scraping homepage: ${site.url}`);
    const result = await scrapePage(app, site.url, {
      onlyMainContent: false,
      includeBranding: true,
    });

    if (result) {
      await saveResult(site.id, "homepage", "index", {
        url: site.url,
        scrapedAt: new Date().toISOString(),
        metadata: result.metadata || null,
        markdown: result.markdown || null,
        html: result.html || null,
        links: result.links || null,
        branding: result.branding || null,
      });
      progress.scraped[homepageKey] = true;
      progress.creditsUsed += 1;
      log("ok", `Homepage scraped for ${site.name}`);
    } else {
      progress.errors.push({
        site: site.id,
        url: site.url,
        type: "homepage",
        time: new Date().toISOString(),
      });
      log("err", `Homepage scrape failed for ${site.name}`);
    }

    await saveProgress(progress);
    await sleep(REQUEST_DELAY_MS);
  }

  // --- Step 3: Scrape articles ---
  let articlesScraped = 0;

  for (const articleUrl of articleUrls) {
    const articleKey = `${site.id}__article__${slugify(articleUrl)}`;

    if (progress.scraped[articleKey]) {
      log("skip", `Already scraped: ${articleUrl.slice(0, 80)}...`);
      continue;
    }

    log("info", `Scraping article [${articlesScraped + 1}/${articleUrls.length}]: ${articleUrl.slice(0, 80)}`);

    const result = await scrapePage(app, articleUrl, {
      onlyMainContent: true,
      includeBranding: false,
    });

    if (result) {
      await saveResult(site.id, "article", slugify(articleUrl), {
        url: articleUrl,
        scrapedAt: new Date().toISOString(),
        metadata: result.metadata || null,
        markdown: result.markdown || null,
        html: result.html || null,
        links: result.links || null,
      });
      progress.scraped[articleKey] = true;
      progress.creditsUsed += 1;
      articlesScraped++;
      log("ok", `Article scraped (${progress.creditsUsed} credits used total)`);
    } else {
      progress.errors.push({
        site: site.id,
        url: articleUrl,
        type: "article",
        time: new Date().toISOString(),
      });
      log("err", `Article scrape failed: ${articleUrl.slice(0, 80)}`);
    }

    await saveProgress(progress);
    await sleep(REQUEST_DELAY_MS);
  }

  log("ok", `Completed ${site.name}: ${articlesScraped} articles scraped`);
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const tierArg = args.includes("--tier")
    ? args[args.indexOf("--tier") + 1]
    : "all";
  const siteArg = args.includes("--site")
    ? args[args.indexOf("--site") + 1]
    : null;

  await ensureDir(RESULTS_DIR);

  if (!FIRECRAWL_API_KEY.trim()) {
    log("err", "FIRECRAWL_API_KEY is not set. Export it or use a research/.env file with your shell loader.");
    process.exit(1);
  }

  // Show credit estimate
  const estimate = estimateCredits();
  log("info", `Credit estimate: Tier1=${estimate.tier1}, Tier2=${estimate.tier2}, Tier3=${estimate.tier3}, Total=${estimate.total}`);

  // Filter sites
  let sites = getAllSites();

  if (siteArg) {
    sites = sites.filter((s) => s.id === siteArg);
    if (sites.length === 0) {
      log("err", `Site "${siteArg}" not found. Available: ${getAllSites().map((s) => s.id).join(", ")}`);
      process.exit(1);
    }
  } else if (tierArg !== "all") {
    const tier = parseInt(tierArg, 10);
    sites = sites.filter((s) => s.tier === tier);
  }

  log("info", `Will process ${sites.length} sites`);

  // Load progress
  const progress = await loadProgress();
  log("info", `Resuming from ${progress.creditsUsed} credits used, ${Object.keys(progress.scraped).length} pages cached`);

  // Initialize Firecrawl
  const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

  // Process sites sequentially
  for (const site of sites) {
    try {
      await processSite(app, site, progress);
    } catch (err) {
      log("err", `Fatal error processing ${site.name}: ${err.message}`);
      progress.errors.push({
        site: site.id,
        error: err.message,
        time: new Date().toISOString(),
      });
      await saveProgress(progress);
    }
  }

  // Final summary
  log("info", `\n${"=".repeat(60)}`);
  log("ok", `SCRAPING COMPLETE`);
  log("info", `Total credits used: ${progress.creditsUsed}`);
  log("info", `Total pages scraped: ${Object.keys(progress.scraped).length}`);
  log("info", `Total errors: ${progress.errors.length}`);
  log("info", `Results saved to: ${RESULTS_DIR}`);
  log("info", `${"=".repeat(60)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
