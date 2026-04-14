/** Must match frontend NAV_TOPICS slugs + catch-all. */
export const PRIMARY_RUBRIC_SLUGS = [
  'ai',
  'hardware',
  'open-source',
  'security',
  'energy',
  'business',
  'media',
  'other'
];

/**
 * @param {unknown} v
 * @returns {string}
 */
export function normalizePrimaryRubric(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (PRIMARY_RUBRIC_SLUGS.includes(s)) return s;
  return 'other';
}

/** @param {string} t */
function tagSlug(t) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** Whole-tag slug is exactly one of the nav rubrics (after slugify). First match wins. */
const RUBRIC_ORDER = ['ai', 'hardware', 'open-source', 'security', 'energy', 'business', 'media'];

const HARDWARE_SEGMENTS = new Set([
  'hardware',
  'intel',
  'nvidia',
  'amd',
  'arm',
  'risc-v',
  'riscv',
  'cpu',
  'gpu',
  'vram',
  'ram',
  'ddr',
  'ssd',
  'motherboard',
  'chip',
  'chips',
  'chipset',
  'soc',
  'foundry',
  'tsmc',
  'workstation',
  'accelerator',
  'accelerators',
  'npu',
  'tpu',
  'fpga',
  'apple-silicon',
  'm4',
  'm3',
  'm2',
  'm1',
  'snapdragon',
  'exynos',
  'mediatek',
  'qualcomm'
]);

const HARDWARE_SUBSTR = [
  'intel',
  'nvidia',
  'geforce',
  'radeon',
  'ryzen',
  'xeon',
  'threadripper',
  'apple-silicon',
  'risc-v',
  'motherboard',
  'workstation-gpu'
];

const OS_SEGMENTS = new Set([
  'linux',
  'kernel',
  'opensource',
  'foss',
  'debian',
  'fedora',
  'ubuntu',
  'redhat',
  'gnu',
  'gpl',
  'apache',
  'mozilla',
  'git'
]);

const OS_SUBSTR = ['open-source', 'open source', 'linux-kernel', 'kernel-', '-kernel', 'github'];

/** Hyphen-separated token inside a tag slug (avoids false positives like "paid" → "ai"). */
const AI_SEGMENTS = new Set([
  'ai',
  'ml',
  'nlp',
  'llm',
  'llms',
  'vlm',
  'slm',
  'gpt',
  'openai',
  'chatgpt',
  'claude',
  'anthropic',
  'gemini',
  'mistral',
  'grok',
  'copilot',
  'deepmind',
  'tensorflow',
  'pytorch',
  'huggingface',
  'hf',
  'midjourney',
  'stable-diffusion',
  'neural',
  'embeddings',
  'embedding',
  'transformer',
  'transformers',
  'reasoning',
  'generative',
  'chatbot',
  'sora',
  'dall-e',
  'dalle',
  'bard',
  'llama',
  'mixtral',
  'perplexity',
  'cursor',
  'codex',
  'agents',
  'agentic',
  'agent',
  'automl',
  'openclaw',
  'inference',
  'finetuning',
  'fine-tuning',
  'multimodal',
  'vision',
  'foundation',
  'hallucination',
  'prompt',
  'tokens',
  'tokenization',
  'rag',
  'vector',
  'semantic',
  'synthetic',
  'deepfake',
  'tts',
  'asr',
  'openai-api',
  'chat-bot',
  'chatbots',
  'diffusion',
  'samsung-galaxy-ai',
  'galaxy-ai',
  'avatar',
  'avatars',
  'generative-ai',
  'gen-ai',
  'genai',
  'language-model',
  'largelanguagemodel',
  'llmops',
  'moe',
  'mixture-of-experts',
  'benchmark',
  'alignment',
  'safety',
  'superintelligence',
  'agi',
  'veo',
  'imagen',
  'flux',
  'sdxl',
  'lora',
  'qlora',
  'quantization',
  'distillation',
  'pretrain',
  'pre-training',
  'dataset',
  'datasets',
  'synthetic-data',
  'computer-vision',
  'ocr',
  'speech',
  'voice',
  'assistant',
  'assistants',
  'orchestration',
  'workflow',
  'langchain',
  'langgraph',
  'crewai',
  'autogpt',
  'news-agent',
  'ai-news',
  'tech-ai',
  'mlops',
  'data-science'
]);

const SECURITY_SEGMENTS = new Set([
  'security',
  'cybersecurity',
  'cyber',
  'malware',
  'ransomware',
  'spyware',
  'phishing',
  'breach',
  'firewall',
  'infosec',
  'zeroday',
  'encryption',
  'vpn',
  'apt',
  'cve',
  'botnet',
  'ddos',
  'pentest',
  'siem',
  'soc',
  'oauth',
  '2fa',
  'mfa',
  'zerotrust'
]);

const SECURITY_SUBSTR = [
  'cybersecurity',
  'cyber-security',
  'cyber-attack',
  'data-breach',
  'data breach',
  'zero-day',
  'zero day',
  'state-sponsored',
  'patch-tuesday',
  'vulnerability-disclosure',
  'supply-chain-attack',
  'ransomware',
  'malware',
  'phishing',
  'spyware',
  'infosec',
  'pentest',
  'encryption-key',
  'side-channel',
  'bug-bounty'
];

const ENERGY_SEGMENTS = new Set([
  'energy',
  'battery',
  'batteries',
  'lithium',
  'cathode',
  'anode',
  'solar',
  'wind',
  'grid',
  'renewable',
  'renewables',
  'hydrogen',
  'cleantech',
  'emission',
  'emissions',
  'refinery',
  'ev',
  'charger',
  'charging',
  'photovoltaic',
  'inverter',
  'megawatt',
  'gigafactory'
]);

const ENERGY_SUBSTR = [
  'electric-vehicle',
  'ev-battery',
  'battery-recycling',
  'clean-energy',
  'renewable-energy',
  'power-grid',
  'offshore-wind',
  'solar-panel',
  'lithium-ion',
  'carbon-neutral',
  'net-zero',
  'climate-tech',
  'energy-storage',
  'charging-network',
  'hydrogen-fuel',
  'wind-farm',
  'solar-farm'
];

const BUSINESS_SEGMENTS = new Set([
  'antitrust',
  'merger',
  'acquisition',
  'acquisitions',
  'earnings',
  'layoffs',
  'layoff',
  'revenue',
  'lawsuit',
  'ipo',
  'valuation',
  'fundraising',
  'tariff',
  'tariffs',
  'sanctions',
  'subsidy',
  'bankruptcy',
  'restructuring',
  'buyback',
  'dividend',
  'guidance',
  'ftc',
  'doj',
  'litigation',
  'monopoly',
  'settlement',
  'investigation',
  'quarterly',
  'shareholder',
  'stakeholder',
  'spinoff',
  'spin-off',
  'takeover',
  'lbo'
]);

const BUSINESS_SUBSTR = [
  'antitrust',
  'merger',
  'acquisition',
  'earnings-call',
  'quarterly-earnings',
  'stock-price',
  'share-price',
  'market-cap',
  'layoffs',
  'revenue-growth',
  'profit-warning',
  'class-action',
  'regulatory-filing',
  'eu-fine',
  'trade-war',
  'venture-capital',
  'vc-funding',
  'funding-round',
  'series-a',
  'series-b',
  'series-c',
  'going-public',
  'insider-trading',
  'price-fixing',
  'sec-filing',
  '10-k',
  '10-q',
  '8-k'
];

const MEDIA_SEGMENTS = new Set([
  'streaming',
  'netflix',
  'spotify',
  'hbo',
  'disney',
  'hulu',
  'esports',
  'gaming',
  'playstation',
  'xbox',
  'nintendo',
  'steam',
  'fortnite',
  'minecraft',
  'twitch',
  'youtube',
  'podcast',
  'podcasts',
  'hollywood',
  'television',
  'broadcast',
  'broadcaster',
  'soundtrack',
  'cinemacon',
  'showrunner',
  'streamer',
  'cord-cutting'
]);

const MEDIA_SUBSTR = [
  'video-streaming',
  'music-streaming',
  'streaming-service',
  'streaming-platform',
  'tv-series',
  'tv-show',
  'late-night',
  'box-office',
  'film-festival',
  'video-game',
  'video-games',
  'game-launch',
  'game-release',
  'console-launch',
  'live-stream',
  'content-creator'
];

const AI_PHRASES = [
  'machine-learning',
  'deep-learning',
  'artificial-intelligence',
  'large-language',
  'generative-ai',
  'gen-ai',
  'computer-vision',
  'natural-language',
  'ai-agent',
  'ai-agents',
  'ai-accelerator',
  'ai-accelerators',
  'ai-ethics',
  'ai-education',
  'ai-avatar',
  'ai-avatars',
  'open-ai',
  'gpt-4',
  'gpt-3',
  'gpt4',
  'gpt3',
  'chat-gpt',
  'text-to-image',
  'text-to-video',
  'voice-cloning',
  'neural-net',
  'neural-network',
  'neural-networks',
  'foundation-model',
  'foundation-models',
  'multimodal',
  'reasoning-model',
  'slm',
  'small-language'
];

/**
 * @param {string[]} slugs — already slugified tag strings
 * @returns {boolean}
 */
function hasHardwareSignal(slugs) {
  for (const s of slugs) {
    for (const seg of s.split('-').filter(Boolean)) {
      if (HARDWARE_SEGMENTS.has(seg)) return true;
    }
    for (const h of HARDWARE_SUBSTR) {
      if (s.includes(h)) return true;
    }
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasOpenSourceSignal(slugs) {
  for (const s of slugs) {
    if (s === 'github' || s.includes('github')) return true;
    for (const seg of s.split('-').filter(Boolean)) {
      if (OS_SEGMENTS.has(seg)) return true;
    }
    for (const p of OS_SUBSTR) {
      if (s.includes(p.replace(/\s+/g, '-'))) return true;
    }
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasAiSignal(slugs) {
  for (const s of slugs) {
    if (/(^|-)ai($|-)/.test(s)) return true;
    for (const p of AI_PHRASES) {
      if (s.includes(p)) return true;
    }
    const segments = s.split('-').filter(Boolean);
    for (const seg of segments) {
      if (AI_SEGMENTS.has(seg)) return true;
    }
    if (segments.includes('machine') && segments.includes('learning')) return true;
    if (segments.includes('artificial') && segments.includes('intelligence')) return true;
    if (segments.includes('large') && segments.includes('language')) return true;
    if (segments.includes('deep') && segments.includes('learning')) return true;
    if (s.includes('llm')) return true;
    if (s.includes('gpt')) return true;
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasSecuritySignal(slugs) {
  for (const s of slugs) {
    for (const seg of s.split('-').filter(Boolean)) {
      if (SECURITY_SEGMENTS.has(seg)) return true;
    }
    for (const p of SECURITY_SUBSTR) {
      if (s.includes(p.replace(/\s+/g, '-'))) return true;
    }
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasEnergySignal(slugs) {
  for (const s of slugs) {
    for (const seg of s.split('-').filter(Boolean)) {
      if (ENERGY_SEGMENTS.has(seg)) return true;
    }
    for (const p of ENERGY_SUBSTR) {
      if (s.includes(p.replace(/\s+/g, '-'))) return true;
    }
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasBusinessSignal(slugs) {
  for (const s of slugs) {
    for (const seg of s.split('-').filter(Boolean)) {
      if (BUSINESS_SEGMENTS.has(seg)) return true;
    }
    for (const p of BUSINESS_SUBSTR) {
      if (s.includes(p.replace(/\s+/g, '-'))) return true;
    }
  }
  return false;
}

/**
 * @param {string[]} slugs
 * @returns {boolean}
 */
function hasMediaSignal(slugs) {
  for (const s of slugs) {
    for (const seg of s.split('-').filter(Boolean)) {
      if (MEDIA_SEGMENTS.has(seg)) return true;
    }
    for (const p of MEDIA_SUBSTR) {
      if (s.includes(p.replace(/\s+/g, '-'))) return true;
    }
  }
  return false;
}

/**
 * Pick one primary rubric from tags (editorial / SEO). Order: explicit rubric tag → hardware →
 * security → energy → open-source → broad AI → business → media → other.
 *
 * @param {string[]} tags
 * @returns {string}
 */
export function inferPrimaryRubricFromTags(tags) {
  const slugs = (Array.isArray(tags) ? tags : []).map(tagSlug).filter(Boolean);

  for (const r of RUBRIC_ORDER) {
    if (slugs.includes(r)) return r;
  }

  if (hasHardwareSignal(slugs)) return 'hardware';
  if (hasSecuritySignal(slugs)) return 'security';
  if (hasEnergySignal(slugs)) return 'energy';
  /* Before open-source: many ML stacks are discussed alongside Linux/GitHub. */
  if (hasOpenSourceSignal(slugs)) return 'open-source';
  if (hasAiSignal(slugs)) return 'ai';
  if (hasBusinessSignal(slugs)) return 'business';
  if (hasMediaSignal(slugs)) return 'media';

  return 'other';
}
