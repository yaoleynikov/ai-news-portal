// =============================================================================
// SiliconFeed Research — Markdown Report Generator
// =============================================================================
// Reads analysis results and generates a structured markdown report
// comparing all competitors across SEO, content, and design dimensions.
// Usage: node report.mjs
// =============================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANALYSIS_DIR = path.join(__dirname, "results", "analysis");
const REPORT_FILE = path.join(__dirname, "results", "COMPETITOR_REPORT.md");

// =============================================================================
// Report Sections
// =============================================================================

function generateHeader() {
  return `# 🔬 SiliconFeed — Competitor Analysis Report

> Generated: ${new Date().toISOString().slice(0, 10)}
> Sources: Firecrawl API scrape data
> Sites analyzed: See tables below

---

## Table of Contents

1. [SEO & Metadata Overview](#1-seo--metadata-overview)
2. [Content Structure Analysis](#2-content-structure-analysis)
3. [Schema.org / JSON-LD Usage](#3-schemaorg--json-ld-usage)
4. [Design Systems & Typography](#4-design-systems--typography)
5. [Color Palettes](#5-color-palettes)
6. [Key Findings & Recommendations](#6-key-findings--recommendations)

---

`;
}

function generateSeoTable(sites) {
  let md = `## 1. SEO & Metadata Overview

| Site | Tier | Description | OG Tags | Twitter Cards | JSON-LD | Canonical | Title Avg Len |
|------|------|-------------|---------|---------------|---------|-----------|---------------|
`;
  for (const s of sites) {
    const yes = "✅";
    const no = "❌";
    md += `| ${s.name} | T${s.tier} | ${s.seo.hasDescription ? yes : no} | ${s.seo.hasOgTags ? yes : no} | ${s.seo.hasTwitterCards ? yes : no} | ${s.seo.hasJsonLd ? yes : no} | ${s.seo.hasCanonical ? yes : no} | ${s.seo.titlePattern?.avgLength || "—"} |\n`;
  }

  // Summary
  const total = sites.length;
  const withDesc = sites.filter((s) => s.seo.hasDescription).length;
  const withOg = sites.filter((s) => s.seo.hasOgTags).length;
  const withTwitter = sites.filter((s) => s.seo.hasTwitterCards).length;
  const withJsonLd = sites.filter((s) => s.seo.hasJsonLd).length;
  const withCanonical = sites.filter((s) => s.seo.hasCanonical).length;

  md += `\n**Summary (${total} sites):**\n`;
  md += `- Meta Description: ${Math.round((withDesc / total) * 100)}% adoption\n`;
  md += `- Open Graph: ${Math.round((withOg / total) * 100)}% adoption\n`;
  md += `- Twitter Cards: ${Math.round((withTwitter / total) * 100)}% adoption\n`;
  md += `- JSON-LD: ${Math.round((withJsonLd / total) * 100)}% adoption\n`;
  md += `- Canonical URL: ${Math.round((withCanonical / total) * 100)}% adoption\n\n`;

  // Title patterns examples
  md += `### Title Pattern Samples\n\n`;
  for (const s of sites.filter((s) => s.seo.titlePattern?.samples?.length)) {
    md += `**${s.name}:** \`${s.seo.titlePattern.samples[0]}\`\n\n`;
  }

  md += `---\n\n`;
  return md;
}

function generateContentTable(sites) {
  const withContent = sites.filter((s) => s.contentStats?.articleCount > 0);

  let md = `## 2. Content Structure Analysis

| Site | Articles | Avg Words | Median | Min | Max | Avg ¶ | Avg Img | Img/1K chars | Avg H-tags | Code |
|------|----------|-----------|--------|-----|-----|-------|---------|--------------|------------|------|
`;
  for (const s of withContent) {
    const c = s.contentStats;
    md += `| ${s.name} | ${c.articleCount} | ${c.avgWordCount} | ${c.medianWordCount} | ${c.minWordCount} | ${c.maxWordCount} | ${c.avgParagraphs} | ${c.avgImages} | ${c.avgImagesPerKChars} | ${c.avgHeadings} | ${c.avgCodeBlocks} |\n`;
  }

  // Cross-site averages
  if (withContent.length > 0) {
    const n = withContent.length;
    const avgW = Math.round(
      withContent.reduce((s, x) => s + x.contentStats.avgWordCount, 0) / n
    );
    const avgI = +(
      withContent.reduce((s, x) => s + x.contentStats.avgImages, 0) / n
    ).toFixed(1);

    md += `\n**Cross-site averages:**\n`;
    md += `- Average article word count: **${avgW} words**\n`;
    md += `- Average images per article: **${avgI}**\n`;
  }

  md += `\n---\n\n`;
  return md;
}

function generateJsonLdSection(sites) {
  let md = `## 3. Schema.org / JSON-LD Usage

| Site | JSON-LD Types |
|------|---------------|
`;
  for (const s of sites.filter((s) => s.seo.jsonLdTypes?.length)) {
    md += `| ${s.name} | ${s.seo.jsonLdTypes.join(", ")} |\n`;
  }

  // Type frequency
  const typeCounts = {};
  for (const s of sites) {
    for (const t of s.seo.jsonLdTypes || []) {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
  }

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  md += `\n### Type Frequency\n\n`;
  md += `| Type | Sites Using |\n|------|-------------|\n`;
  for (const [type, count] of sorted) {
    md += `| ${type} | ${count} |\n`;
  }

  md += `\n**Recommendation for SiliconFeed:** Use \`NewsArticle\` as primary type with \`Organization\`, \`WebSite\`, and \`BreadcrumbList\`.\n\n`;
  md += `---\n\n`;
  return md;
}

function generateDesignSection(sites) {
  const withBranding = sites.filter((s) => s.branding);

  let md = `## 4. Design Systems & Typography

| Site | Color Scheme | Primary Font | Heading Font | Body Size | H1 Size |
|------|-------------|-------------|-------------|-----------|---------|
`;
  for (const s of withBranding) {
    const b = s.branding;
    const primaryFont = b.typography?.fontFamilies?.primary || b.fonts?.[0]?.family || "—";
    const headingFont = b.typography?.fontFamilies?.heading || "—";
    const bodySize = b.typography?.fontSizes?.body || "—";
    const h1Size = b.typography?.fontSizes?.h1 || "—";

    md += `| ${s.name} | ${b.colorScheme || "—"} | ${primaryFont} | ${headingFont} | ${bodySize} | ${h1Size} |\n`;
  }

  // Font frequency
  const fontCounts = {};
  for (const s of withBranding) {
    const fonts = s.branding.fonts || [];
    for (const f of fonts) {
      if (f.family) {
        fontCounts[f.family] = (fontCounts[f.family] || 0) + 1;
      }
    }
  }

  const topFonts = Object.entries(fontCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (topFonts.length > 0) {
    md += `\n### Most Popular Fonts\n\n`;
    md += `| Font | Sites Using |\n|------|-------------|\n`;
    for (const [font, count] of topFonts) {
      md += `| ${font} | ${count} |\n`;
    }
  }

  md += `\n---\n\n`;
  return md;
}

function generateColorSection(sites) {
  const withColors = sites.filter((s) => s.branding?.colors);

  let md = `## 5. Color Palettes

| Site | Primary | Secondary | Accent | Background | Text |
|------|---------|-----------|--------|------------|------|
`;
  for (const s of withColors) {
    const c = s.branding.colors;
    const swatch = (color) => (color ? `\`${color}\`` : "—");
    md += `| ${s.name} | ${swatch(c.primary)} | ${swatch(c.secondary)} | ${swatch(c.accent)} | ${swatch(c.background)} | ${swatch(c.textPrimary)} |\n`;
  }

  md += `\n---\n\n`;
  return md;
}

function generateRecommendations(sites) {
  const withContent = sites.filter((s) => s.contentStats?.articleCount > 0);

  let md = `## 6. Key Findings & Recommendations for SiliconFeed

### SEO Must-Haves
- ✅ **Meta description** on every article (industry standard)
- ✅ **Open Graph tags** (og:title, og:description, og:image) — essential for social sharing
- ✅ **Twitter Cards** (twitter:card = summary_large_image)
- ✅ **JSON-LD** structured data: \`NewsArticle\` schema with \`author\`, \`datePublished\`, \`image\`
- ✅ **Canonical URLs** — prevent duplicate content issues
- ✅ **Title format**: \`[Article Title] | SiliconFeed\` — avg length ~55-65 chars

### Content Guidelines
`;

  if (withContent.length > 0) {
    const avgWords = Math.round(
      withContent.reduce((s, x) => s + x.contentStats.avgWordCount, 0) /
        withContent.length
    );
    const avgImages = +(
      withContent.reduce((s, x) => s + x.contentStats.avgImages, 0) /
        withContent.length
    ).toFixed(1);

    md += `- 📝 **Target article length**: ${avgWords} words (industry average)\n`;
    md += `- 🖼️ **Images per article**: ${avgImages} (industry average)\n`;
    md += `- 📊 Our skip logic (500–10K chars) aligns with typical article lengths\n`;
  }

  md += `
### Design Recommendations
- 🎨 Dark mode preferred by modern tech audiences
- 📱 Mobile-first responsive design
- ⚡ Focus on Core Web Vitals: LCP < 2.5s, CLS < 0.1
- 🔤 Use Inter/Geist/Outfit for body, system stack as fallback
- 🎯 Emphasis on typography hierarchy: clear H1 > H2 > H3 distinction

### Architecture Takeaways
- All top sites use JSON-LD structured data
- Most use \`NewsArticle\` or \`Article\` schema type
- Rich snippet eligibility requires: title, author, date, image, description
- Breadcrumb schema improves SERP appearance
`;

  return md;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  let sites;
  try {
    const data = await fs.readFile(
      path.join(ANALYSIS_DIR, "_combined.json"),
      "utf-8"
    );
    sites = JSON.parse(data);
  } catch {
    console.error(
      "❌ No analysis data found. Run 'node analyzer.mjs' first."
    );
    process.exit(1);
  }

  console.log(`\nGenerating report for ${sites.length} sites...\n`);

  let report = generateHeader();
  report += generateSeoTable(sites);
  report += generateContentTable(sites);
  report += generateJsonLdSection(sites);
  report += generateDesignSection(sites);
  report += generateColorSection(sites);
  report += generateRecommendations(sites);

  await fs.writeFile(REPORT_FILE, report);

  console.log(`✅ Report generated: ${REPORT_FILE}`);
  console.log(`   ${sites.length} sites, ${report.length} chars\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
