import { describe, expect, it } from 'vitest';
import { processTextBlock, sanitizeCitations } from '../citations';

const sources = [
  { content: 'a', metadata: { url: 'https://a.test' } },
  { content: 'b', metadata: { url: 'https://b.test' } },
];

describe('processTextBlock', () => {
  it('turns [n] and [n, m] into citation links', () => {
    expect(processTextBlock('Fato[1]. Outro[1, 2].', sources).text).toBe(
      'Fato<citation href="https://a.test">1</citation>. Outro<citation href="https://a.test">1</citation><citation href="https://b.test">2</citation>.',
    );
  });

  it('drops citations to missing sources and keeps non-numeric brackets', () => {
    expect(processTextBlock('X[3] Y[abc] Z[0]', sources).text).toBe(
      'X Y[abc] Z[0]',
    );
  });

  it('removes [n] when there are no sources', () => {
    expect(processTextBlock('Sem fonte[1].', []).text).toBe('Sem fonte.');
  });

  it('strips citations from the speech text', () => {
    expect(processTextBlock('Fato[1].', sources).speech).toBe('Fato.');
  });

  it('closes an unfinished think tag and reports when thinking ended', () => {
    expect(processTextBlock('<think>hmm', sources)).toMatchObject({
      text: '<think>hmm</think> <a> </a>',
      thinkingEnded: false,
    });
    expect(processTextBlock('<think>a</think>b', sources).thinkingEnded).toBe(
      true,
    );
  });
});

describe('sanitizeCitations', () => {
  it('leaves valid citations exactly as written', () => {
    const text = 'Fato[1]. Outro [1, 2]. Mais[2][1].';
    expect(sanitizeCitations(text, 2)).toBe(text);
  });

  it('drops citations above the number of sources', () => {
    expect(sanitizeCitations('Fato [3]. Outro[5].', 2)).toBe('Fato. Outro.');
  });

  it('keeps the valid numbers of a mixed group', () => {
    expect(sanitizeCitations('Fato [1, 7, 2].', 2)).toBe('Fato [1, 2].');
  });

  it('drops every numeric citation when there are no sources', () => {
    expect(sanitizeCitations('Sem fonte [1].', 0)).toBe('Sem fonte.');
  });

  it('leaves code, links and non-numeric brackets alone', () => {
    const text =
      'Use `arr[10]` ou\n```\nx = v[42]\n```\nVeja [9](https://x.test) e [nota] e [0].';
    expect(sanitizeCitations(text, 2)).toBe(text);
  });
});
