/**
 * Smoke: what the image model sees for abstract covers (RSS-style inputs).
 * Run: node scripts/cover-prompt-smoke.mjs
 */
import { normalizeRewritten } from '../src/brain/rewriter.js';
import {
  buildAbstractImagePrompt,
  buildAbstractFallbackKeywordFromArticle,
  FALLBACK_ABSTRACT_COVER_KEYWORD
} from '../src/media/generator.js';

function section(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

function showCase(name, keyword) {
  const brief = buildAbstractImagePrompt(keyword).hfInputs;
  console.log(`\n--- ${name} ---`);
  console.log('cover_keyword / seed length:', String(keyword).length);
  console.log('keyword (first 320 chars):\n', String(keyword).slice(0, 320) + (String(keyword).length > 320 ? '…' : ''));
  console.log('\nmodel_brief length:', brief.length);
  console.log('model_brief (first 900 chars):\n', brief.slice(0, 900) + (brief.length > 900 ? '…' : ''));
}

const baseArticle = {
  slug: 'test',
  content_md:
    '### At a glance:\n- UK startup secures grant for EV battery refinery\n- Facility in Plymouth\n- Government-backed programme\n\n## Funding\n\nAltilium announced £18.5m for ACT3. The plant will recycle end-of-life batteries.',
  tags: ['Tech'],
  dek: 'UK battery recycling startup wins government funding for a commercial refinery in Plymouth.',
  primary_rubric: 'hardware',
  faq: [
    { q: 'Q1?', a: 'Answer one with enough text for the validator and story.' },
    { q: 'Q2?', a: 'Answer two with enough text for the validator and story.' },
    { q: 'Q3?', a: 'Answer three with enough text for the validator and story.' }
  ],
  entities: [{ name: 'Altilium', desc: 'Battery recycling' }],
  sentiment: 5
};

section('1) Abstract — модель рерайта дала сильную сцену (идеал)');
showCase(
  'strong scene',
  normalizeRewritten({
    ...baseArticle,
    title: 'UK startup bags £18.5m for first commercial EV battery refinery',
    cover_type: 'abstract',
    company_logo_domain: null,
    cover_keyword:
      'Interior of a modern hydrometallurgical battery recycling hall in Plymouth, engineers in hi-vis near stainless tanks, overhead crane, cool daylight through clerestory windows, documentary news photo'
  }).cover_keyword
);

section('2) Abstract — слабый стоковый cover_keyword (риск плохой картинки)');
showCase('weak stock-ish', 'journalist desk with laptop and coffee mug, bright office');

section('3) Abstract — пустой cover_keyword → normalizeRewritten подставит FALLBACK константу');
const emptyKw = normalizeRewritten({
  ...baseArticle,
  title: 'Some title',
  cover_type: 'abstract',
  cover_keyword: ''
}).cover_keyword;
showCase('empty → FALLBACK', emptyKw);

section('4) Даунгрейд company→abstract: buildAbstractFallbackKeywordFromArticle(title, content_md)');
const fromArticle = buildAbstractFallbackKeywordFromArticle(
  'UK startup Altilium bags £18.5m to build EV battery refinery',
  baseArticle.content_md
);
showCase('title+body slice', fromArticle ?? FALLBACK_ABSTRACT_COVER_KEYWORD);

section('5) Company — в БД cover_keyword = домен (для картинки не используется, только Logo.dev)');
const companyRow = normalizeRewritten({
  ...baseArticle,
  title: 'OpenAI releases new API feature',
  cover_type: 'company',
  company_logo_domain: 'openai.com',
  cover_keyword: 'openai.com'
});
console.log('\ncover_type:', companyRow.cover_type, '| cover_keyword:', companyRow.cover_keyword);
console.log('(Текстовый diffusion-промпт при company не вызывается, пока не упадёт Logo.dev.)');

console.log('\n' + '='.repeat(72));
console.log('Готово.');
console.log('='.repeat(72) + '\n');
