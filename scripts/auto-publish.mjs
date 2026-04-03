import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const postsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'posts');

function fetch(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Insight/1.0)' } }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', (e) => resolve({ status: 0, body: '', error: e.message }));
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractMetaTag(html, property) {
  const regex = new RegExp(`<meta[^>]*(?:${property}=["'][^"']*["'])[^>]*/?>`, 'i');
  const match = html.match(regex);
  if (!match) return '';
  const content = match[0].match(/content="([^"]+)"/i);
  return content ? content[1] : '';
}

function extractImage(html) {
  return extractMetaTag(html, 'og:image') || extractMetaTag(html, 'image') || '';
}

async function scrapeTheneuron() {
  const res = await fetch('https://www.theneuron.ai/');
  if (!res.body || res.status !== 200) return [];
  
  const articles = [];
  const hrefRegex = /href="(https:\/\/www\.theneuron\.ai\/[^"]*ai-news[^"]*|https:\/\/www\.theneuron\.ai\/explainer[^"]*)"[^>]*>\s*([^<]{30,120})\s*<\/a>/gi;
  let match;
  while ((match = hrefRegex.exec(res.body)) !== null) {
    articles.push({ url: match[1], title: match[2].trim(), source: 'theneuron' });
  }
  return [...new Map(articles.map(a => [a.url, a])).values()];
}

async function scrapeDecrypt() {
  const res = await fetch('https://decrypt.co/news/artificial-intelligence');
  if (!res.body || res.status !== 200) return [];
  
  const articles = [];
  const hrefRegex = /href="(https:\/\/decrypt\.co\/[^"]*)"[^>]*>\s*([^<]{30,150})\s*<\/a>/gi;
  let match;
  while ((match = hrefRegex.exec(res.body)) !== null) {
    if (match[2].trim().length > 30) {
      articles.push({ url: match[1], title: match[2].trim(), source: 'decrypt' });
    }
  }
  return [...new Map(articles.map(a => [a.url, a])).values()];
}

async function scrapeTechStartups() {
  const res = await fetch('https://techstartups.com/category/latest-tech-news/');
  if (!res.body || res.status !== 200) return [];

  const articles = [];
  const hrefRegex = /href="(https:\/\/techstartups\.com\/[^"]*)"[^>]*>\s*([^<]{30,150})\s*<\/a>/gi;
  let match;
  while ((match = hrefRegex.exec(res.body)) !== null) {
    if (match[2].trim().length > 30) {
      articles.push({ url: match[1], title: match[2].trim(), source: 'techstartups' });
    }
  }
  return [...new Map(articles.map(a => [a.url, a])).values()];
}

function extractTags(text) {
  const lower = text.toLowerCase();
  const tags = [];
  const map = {
    'Google': /google/g, 'OpenAI': /openai/g, 'Microsoft': /microsoft/g, 'Meta': /\bmeta\b/g,
    'Anthropic': /anthropic/g, 'LLM': /\bllm\b/g, 'AI Safety': /\bai\s*safety/g,
    'Startup': /\bstartup\b/g, 'Robotics': /\brobot/g, 'Crypto': /\bcrypto|bitcoin|ethereum/g,
    'Security': /\bsecurity|hack|breach/g, 'Apple': /\bapple\b/g,
  };
  for (const [tag, re] of Object.entries(map)) {
    if (re.test(lower)) tags.push(tag);
  }
  if (tags.length === 0) tags.push('AI', 'Tech');
  return tags.slice(0, 4);
}

function generateRewrite(originalTitle, originalText, url, coverImage, date) {
  const sentences = originalText.split('. ')
    .filter(s => s.trim().length > 50 && s.trim().length < 500)
    .slice(0, 20);

  const paragraphs = [];
  let current = [];
  for (const sentence of sentences) {
    current.push(sentence);
    if (current.length >= 3) {
      paragraphs.push(current.join('. ') + '.');
      current = [];
    }
  }
  if (current.length > 0) paragraphs.push(current.join('. ') + '.');

  const sections = paragraphs.slice(0, 6).map((p, i) => {
    const heading = i === 0 ? 'Главное' : i === 1 ? 'Детали' : i === 2 ? 'Контекст' : `Анализ ${i - 1}`;
    return `## ${heading}\n\n${p}\n`;
  }).join('\n');

  const slug = originalTitle.toLowerCase()
    .replace(/[^\w\sа-яё-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60) + '-' + date.replace(/-/g, '');

  const excerpt = (paragraphs[0] || originalText.substring(0, 200)).substring(0, 200).replace(/"/g, "'");

  return {
    slug,
    content: `---
title: "${originalTitle.replace(/"/g, '\\"').substring(0, 120)}"
date: "${date}"
excerpt: "${excerpt}"
tags: [${extractTags(originalText).map(t => `"${t}"`).join(', ')}]
coverImage: "${coverImage}"
source: "${url}"
author: "AI-Insight"
---

${sections.length > 0 ? sections : originalText.substring(0, 2000)}

## Мнение Монстра \uD83E\uDD16

_Анализ: ИИ меняет правила игры каждый день. Это не хайп — это новая реальность._

`,
  };
}

async function main() {
  console.log('=== AI-Insight Auto-Publish ===');
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  console.log('Date:', date);

  // Ensure posts directory exists
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  // Get existing posts to avoid duplicates
  const existingFiles = fs.readdirSync(postsDir);
  const existingSources = new Set();
  const existingTitles = new Set();
  for (const file of existingFiles) {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const srcMatch = content.match(/source: "([^"]+)"/);
    const titleMatch = content.match(/title: "([^"]+)"/);
    if (srcMatch) existingSources.add(srcMatch[1]);
    if (titleMatch) existingTitles.add(titleMatch[1]);
  }
  console.log('Existing sources:', existingSources.size);

  // Scrape multiple sources
  const sources = [
    scrapeTheneuron(),
    scrapeDecrypt(),
    scrapeTechStartups(),
  ];
  const results = await Promise.all(sources);
  let allArticles = results.flat();
  
  // Filter out already published
  allArticles = allArticles.filter(a => 
    !existingSources.has(a.url) && !existingTitles.has(a.title)
  );
  
  console.log('New articles found:', allArticles.length);

  let published = 0;
  for (const article of allArticles.slice(0, 2)) {
    console.log('\nFetching:', article.title.substring(0, 80));
    const res = await fetch(article.url);
    if (!res.body || res.status !== 200) {
      console.log('  Failed to fetch content');
      continue;
    }

    const text = stripHtml(res.body);
    if (text.length < 300) {
      console.log('  Not enough content:', text.length, 'chars');
      continue;
    }

    const coverImage = extractImage(res.body);
    const result = generateRewrite(article.title, text, article.url, coverImage, date);
    
    // Unique filename
    const filename = result.slug + (published > 0 ? `-${published}` : '') + '.md';
    const filepath = path.join(postsDir, filename);
    fs.writeFileSync(filepath, result.content);
    console.log('  Published:', filename);
    published++;

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nTotal published this run: ${published}`);
}

main().catch(console.error);
