#!/usr/bin/env node
// Compares src/i18n/messages/en.json and pt-BR.json.
// Fails (exit 1) on: keys missing in either file, a key that is a string in
// one file and an object in the other, empty strings, and ICU arguments that
// differ between the two translations of the same key ({count}, {name}, ...).
// Warns (exit 0) on pt-BR values identical to English, which are often
// strings someone forgot to translate.
//
// Usage: node .claude/skills/i18n-sync/scripts/check-keys.mjs [--strict]
//   --strict  also fail on the "identical to English" warnings.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dir = resolve(root, 'src/i18n/messages');
const base = 'en';
const others = ['pt-BR'];
const strict = process.argv.includes('--strict');

// Identical-to-English values that are fine as they are (brand names, units,
// technical terms). Keys are full dotted paths.
const SAME_OK = new Set([
  'Metadata.chatTitle',
  'Sources.web',
  'Sources.social',
  'Optimization.beta',
  'Library.chatCount',
  'Stock.volume',
  'Benchmark.col.embeddings',
  'Benchmark.col.search',
  'Benchmark.severity.bug',
]);
const SAME_OK_VALUE =
  /^(Vane|OK|API|URL|MCP|Bifrost|SearXNG|Firecrawl|Ollama|LM Studio|Groq|Gemini|OpenAI|Anthropic|Lemonade|Transformers|Email|Backend|Benchmark|Status|Imperial|Total|Token|Tokens|[^A-Za-z]*)$/;

const load = (locale) =>
  JSON.parse(readFileSync(resolve(dir, `${locale}.json`), 'utf8'));

const flatten = (obj, prefix = '', out = new Map()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
};

const namespaces = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const key = prefix ? `${prefix}.${k}` : k;
      out.add(key);
      namespaces(v, key, out);
    }
  }
  return out;
};

// Minimal ICU MessageFormat walker: returns the set of argument names and
// their types, e.g. {count, plural, ...} -> "count:plural". Option bodies of
// plural/select are walked as message text, so `{he}` inside `male {he}` is
// not mistaken for an argument.
const icuArgs = (msg) => {
  const args = new Set();
  let i = 0;
  const text = (stopAtBrace) => {
    while (i < msg.length) {
      const c = msg[i];
      if (c === "'") {
        // ICU quoting: '' is a literal quote, '{...}' escapes braces.
        const next = msg[i + 1];
        if (next === "'") {
          i += 2;
          continue;
        }
        if (next === '{' || next === '}') {
          const end = msg.indexOf("'", i + 1);
          i = end === -1 ? msg.length : end + 1;
          continue;
        }
        i++;
        continue;
      }
      if (c === '{') {
        i++;
        argument();
        continue;
      }
      if (c === '}') {
        if (stopAtBrace) return;
        i++;
        continue;
      }
      i++;
    }
  };
  const ws = () => {
    while (/\s/.test(msg[i] ?? '')) i++;
  };
  const word = () => {
    ws();
    const start = i;
    while (i < msg.length && !/[\s,{}]/.test(msg[i])) i++;
    return msg.slice(start, i);
  };
  const argument = () => {
    const name = word();
    ws();
    let type = 'simple';
    if (msg[i] === ',') {
      i++;
      type = word();
      ws();
      if (msg[i] === ',') {
        i++;
        if (['plural', 'select', 'selectordinal'].includes(type)) {
          // options: keyword {body} keyword {body} ...
          while (i < msg.length) {
            ws();
            if (msg[i] === '}') {
              i++;
              break;
            }
            word(); // option keyword (one, other, =0, offset:1, male...)
            ws();
            if (msg[i] === '{') {
              i++;
              text(true);
              i++;
            }
          }
          args.add(`${name}:${type}`);
          return;
        }
        // number/date/time style: skip to closing brace
        while (i < msg.length && msg[i] !== '}') i++;
      }
    }
    if (msg[i] === '}') i++;
    args.add(`${name}:${type}`);
  };
  text(false);
  return args;
};

const errors = [];
const warnings = [];

const enRaw = load(base);
const en = flatten(enRaw);
const enNs = namespaces(enRaw);

for (const locale of others) {
  const raw = load(locale);
  const other = flatten(raw);
  const otherNs = namespaces(raw);

  for (const key of en.keys()) {
    if (!other.has(key)) {
      errors.push(
        otherNs.has(key)
          ? `${locale}: "${key}" is an object, en has a string`
          : `${locale}: missing "${key}"`,
      );
    }
  }
  for (const key of other.keys()) {
    if (!en.has(key)) {
      errors.push(
        enNs.has(key)
          ? `${locale}: "${key}" is a string, en has an object`
          : `${locale}: extra key "${key}" (not in en.json)`,
      );
    }
  }

  for (const [key, enVal] of en) {
    if (!other.has(key)) continue;
    const val = other.get(key);
    if (typeof enVal !== 'string' || typeof val !== 'string') {
      if (typeof enVal !== typeof val)
        errors.push(
          `${locale}: "${key}" has type ${typeof val}, en has ${typeof enVal}`,
        );
      continue;
    }
    if (val.trim() === '') errors.push(`${locale}: "${key}" is empty`);
    const a = [...icuArgs(enVal)].sort().join(', ');
    const b = [...icuArgs(val)].sort().join(', ');
    if (a !== b)
      errors.push(
        `${locale}: "${key}" arguments differ: en {${a}} vs ${locale} {${b}}`,
      );
    if (val === enVal && !SAME_OK.has(key) && !SAME_OK_VALUE.test(val))
      warnings.push(
        `${locale}: "${key}" is identical to English: ${JSON.stringify(val)}`,
      );
  }
  for (const [key, val] of en)
    if (typeof val === 'string' && val.trim() === '')
      errors.push(`en: "${key}" is empty`);

  console.log(
    `${base}.json: ${en.size} keys, ${locale}.json: ${other.size} keys`,
  );
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`error ${e}`);

const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(
  failed
    ? `\ni18n check failed: ${errors.length} error(s), ${warnings.length} warning(s)`
    : `\ni18n check passed (${warnings.length} warning(s))`,
);
process.exit(failed ? 1 : 0);
