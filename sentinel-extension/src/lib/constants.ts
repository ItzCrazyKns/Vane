// WebLLM Model
export const WEBLLM_MODEL_ID = 'gemma-3n-E2B-it-q4f16_1-MLC';

// Threat thresholds by sensitivity level
export const THREAT_THRESHOLDS = {
  low: 0.7,
  medium: 0.5,
  high: 0.3,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  EVIDENCE_RECORDS: 'sentinelEvidenceRecords',
  SETTINGS: 'sentinelSettings',
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  autoAnalysis: true,
  sensitivityLevel: 'medium' as const,
  autoExit: false,
};

// Evidence limits
export const MAX_EVIDENCE_RECORDS = 100;

// Safe exit URL
export const SAFE_EXIT_URL = 'chrome://newtab';

// Suspicious TLDs
export const SUSPICIOUS_TLDS = [
  '.xyz',
  '.top',
  '.club',
  '.work',
  '.click',
  '.loan',
  '.online',
  '.icu',
  '.buzz',
  '.gq',
  '.ml',
  '.cf',
  '.tk',
  '.ga',
];

// Brand lookalike patterns
export const LOOKALIKE_PATTERNS = [
  { brand: 'google', pattern: /g[o0]{2}gle|go+gle/i },
  { brand: 'paypal', pattern: /paypa[l1]|paypa1/i },
  { brand: 'amazon', pattern: /amaz[o0]n|amazn/i },
  { brand: 'microsoft', pattern: /micros[o0]ft|mircosoft/i },
  { brand: 'apple', pattern: /app[l1]e|aple/i },
  { brand: 'facebook', pattern: /faceb[o0]{2}k|facebok/i },
  { brand: 'netflix', pattern: /netf[l1]ix|netfix/i },
  { brand: 'bank', pattern: /bank.*secure|secure.*bank/i },
  { brand: 'chase', pattern: /chas[e3]|cha5e/i },
  { brand: 'wellsfargo', pattern: /we[l1]{2}sfargo|wellsfarg[o0]/i },
];

// Urgency keywords for DOM scanning
export const URGENCY_KEYWORDS = [
  'act now',
  'urgent',
  'immediate action',
  'account suspended',
  'verify immediately',
  'expires today',
  'last warning',
  'your account has been',
  'unauthorized access',
  'confirm your identity',
  'security alert',
  'unusual activity',
];

// Financial keywords for DOM scanning
export const FINANCIAL_KEYWORDS = [
  'bank account',
  'credit card',
  'ssn',
  'social security',
  'wire transfer',
  'bitcoin',
  'gift card',
  'routing number',
  'account number',
  'tax refund',
  'irs',
];

// Script obfuscation patterns
export const OBFUSCATION_PATTERNS = [
  /eval\s*\(/,
  /document\.write/,
  /unescape\s*\(/,
  /fromCharCode/,
  /\\x[0-9a-f]{2}/i,
  /atob\s*\(/,
  /String\.raw/,
];

// Ignored URL prefixes (don't analyze these)
export const IGNORED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'brave://',
  'moz-extension://',
];
