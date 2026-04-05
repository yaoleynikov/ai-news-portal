import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'auto-publish.mjs');
let content = fs.readFileSync(filePath, 'utf8');

// Fix Gadgets regex to include ipad and app
content = content.replace(
  /{ tag: 'Gadgets', re: \/\\bsmartphone\|iphone\|android\|tablet\|wearable\|smartwatch\|samsung\\b\/gi,[^}]*/g,
  "{ tag: 'Gadgets', re: /\\bsmartphone|iphone|android|tablet|wearable|smartwatch|samsung|ipad|ipod|macbook|laptop\\b/gi"
);

// Fix Big-Tech regex to include 'apple' properly (already there, but add 'ios' and 'xcode')
content = content.replace(
  /{ tag: 'Big-Tech', re: [^}]+}/g,
  "{ tag: 'Big-Tech', re: /\\bgoogle\\b|\\bmeta\\b|\\bmicrosoft\\b|\\bamazon\\b|\\bapple\\b|\\bopenai\\b|\\banthropic\\b|\\bios\\b/gi"
);

// Startups tag - add YC, a16z, venture capital, incubator
content = content.replace(
  /{ tag: 'Startups', re: [^}]+}/g,
  "{ tag: 'Startups', re: /\\bstartup\\b|seed\\s+round|series\\s+[a-f]|funding|accelerator|unicorn|ipo|y\\s*combinator|vc|venture\\s+capital|incubator\\b/gi"
);

// Remove duplicate tag entries (if any) - deduplicate by tag name
const tagRegex = /{ tag: '[^']+', re: \/[^\/]+\/gi[^}]*},/g;
const tags = [...content.matchAll(tagRegex)];
const seen = new Set();
const duplicates = [];

// Instead, let's just check if the regex still looks right
const gadgetsMatch = content.match(/{ tag: 'Gadgets', re: \/[^/]+\/gi/);
const startupsMatch = content.match(/{ tag: 'Startups', re: \/[^/]+\/gi/);
const bigtechMatch = content.match(/{ tag: 'Big-Tech', re: \/[^/]+\/gi/);

console.log('Gadgets:', gadgetsMatch?.[0]?.substring(0, 100) || 'NOT FOUND');
console.log('Startups:', startupsMatch?.[0]?.substring(0, 100) || 'NOT FOUND');
console.log('Big-Tech:', bigtechMatch?.[0]?.substring(0, 100) || 'NOT FOUND');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nWrote file');
