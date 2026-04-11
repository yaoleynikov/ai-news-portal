/**
 * Smoke test: markdown preamble / fences + JSON (no OpenRouter).
 * Run: node scripts/rewriter-json-smoke.mjs
 */
import {
  prepareRewriterJsonText,
  parseRewriterModelJson,
  normalizeRewritten
} from '../src/brain/rewriter.js';

const min = {
  title: 'Test title',
  slug: 'test-title-z',
  content_md:
    '### At a glance:\n- First bullet\n- Second bullet\n\n## Section\n\nParagraph one here. Paragraph continues with more text.',
  tags: ['Tech'],
  dek: 'Plain text dek for the card that is long enough here.',
  primary_rubric: 'other',
  cover_type: 'abstract',
  cover_keyword: 'journalist desk laptop coffee',
  faq: [
    { q: 'Q1?', a: 'Answer one with enough text for the validator and story.' },
    { q: 'Q2?', a: 'Answer two with enough text for the validator and story.' },
    { q: 'Q3?', a: 'Answer three with enough text for the validator and story.' }
  ],
  entities: [{ name: 'Acme', desc: 'Company' }],
  sentiment: 5
};

const jsonStr = JSON.stringify(min);
const preamble = '### At a glance:\n- oops outside json\n- model mistake\n\n';

const cases = [
  { name: 'markdown preamble + raw JSON', text: preamble + jsonStr },
  { name: 'fenced JSON after markdown', text: `${preamble}\`\`\`json\n${jsonStr}\n\`\`\`` },
  { name: 'raw JSON only', text: jsonStr }
];

for (const c of cases) {
  const t = prepareRewriterJsonText(c.text);
  const p = parseRewriterModelJson(t);
  const n = normalizeRewritten(p);
  if (n.slug !== min.slug) throw new Error(`${c.name}: slug mismatch`);
  if (!n.content_md.includes('### At a glance')) throw new Error(`${c.name}: content_md missing glance`);
  console.log('ok:', c.name);
}

const companyFixture = {
  ...min,
  slug: 'test-company-logo',
  cover_type: 'company',
  company_logo_domain: 'X.COM',
  cover_keyword: ''
};
const companyJson = JSON.stringify(companyFixture);
const nc = normalizeRewritten(parseRewriterModelJson(prepareRewriterJsonText(companyJson)));
if (nc.cover_type !== 'company') throw new Error('company fixture: cover_type');
if (nc.cover_keyword !== 'x.com') throw new Error(`company fixture: cover_keyword got ${nc.cover_keyword}`);
console.log('ok: company_logo_domain fills cover_keyword');

console.log('rewriter-json-smoke: all cases passed');
