import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSearchSources,
  isResponseFormat,
} from '../src/app/api/search/responseFormat.ts';

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
};

const sources = deepFreeze([
  {
    content: 'Synthetic source text for the first citation.',
    metadata: {
      title: 'First source',
      url: 'https://example.com/first',
      embedding: [0.1, 0.2],
      similarity: 0.9,
      internal: { content: 'Synthetic internal text' },
    },
    internal: { raw: 'Synthetic extra field' },
  },
  {
    content: 'Synthetic source text for the second citation.',
    metadata: {
      title: 'Second source',
      url: 'https://example.com/second',
      embedding: [0.3, 0.4],
    },
  },
]);
const originalSources = JSON.stringify(sources);

test('accepts the three response formats', () => {
  for (const format of ['full', 'summary-only', 'metadata-only']) {
    assert.equal(isResponseFormat(format), true);
  }
});

test('rejects unknown formats and values of other types', () => {
  for (const value of [
    undefined,
    null,
    '',
    'summary',
    'FULL',
    'unknown',
    0,
    true,
    [],
    {},
    new String('full'),
  ]) {
    assert.equal(isResponseFormat(value), false);
  }
});

test('full preserves the original array and every existing field', () => {
  const result = formatSearchSources(sources, 'full');

  assert.strictEqual(result, sources);
  assert.equal(JSON.stringify(result), originalSources);
});

test('metadata-only keeps citation order and only title and URL', () => {
  const result = formatSearchSources(sources, 'metadata-only');

  assert.deepEqual(result, [
    {
      metadata: {
        title: 'First source',
        url: 'https://example.com/first',
      },
    },
    {
      metadata: {
        title: 'Second source',
        url: 'https://example.com/second',
      },
    },
  ]);
  assert.notStrictEqual(result, sources);
  result.forEach((source, index) => {
    assert.notStrictEqual(source, sources[index]);
    assert.notStrictEqual(source.metadata, sources[index].metadata);
  });
  assert.equal(JSON.stringify(sources), originalSources);
});

test('summary-only omits sources without changing the original data', () => {
  assert.equal(formatSearchSources(sources, 'summary-only'), undefined);
  assert.equal(JSON.stringify(sources), originalSources);
});

test('handles an empty source list in every format', () => {
  const emptySources = deepFreeze([]);

  assert.strictEqual(formatSearchSources(emptySources, 'full'), emptySources);
  assert.equal(formatSearchSources(emptySources, 'summary-only'), undefined);
  const metadataSources = formatSearchSources(emptySources, 'metadata-only');
  assert.deepEqual(metadataSources, []);
  assert.notStrictEqual(metadataSources, emptySources);
});
