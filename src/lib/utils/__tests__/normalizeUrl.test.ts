import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../normalizeUrl';

describe('normalizeUrl', () => {
  it('treats tracking, fragment, host case and trailing slash as the same page', () => {
    const variants = [
      'https://Example.COM/news/item/',
      'https://example.com/news/item#comments',
      'https://example.com/news/item?utm_source=x&utm_medium=y',
      'https://example.com/news/item/?fbclid=abc',
      'https://example.com/news/item?gclid=1#top',
    ];
    expect(new Set(variants.map(normalizeUrl))).toEqual(
      new Set(['https://example.com/news/item']),
    );
  });

  it('keeps meaningful differences', () => {
    expect(normalizeUrl('https://a.test/x?id=1')).not.toBe(
      normalizeUrl('https://a.test/x?id=2'),
    );
    expect(normalizeUrl('https://a.test/X')).not.toBe(
      normalizeUrl('https://a.test/x'),
    );
    expect(normalizeUrl('http://a.test/x')).not.toBe(
      normalizeUrl('https://a.test/x'),
    );
    expect(normalizeUrl('https://a.test/x?id=1&utm_campaign=z')).toBe(
      'https://a.test/x?id=1',
    );
  });

  it('leaves non-http strings alone', () => {
    expect(normalizeUrl(' file_id://abc ')).toBe('file_id://abc');
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});
