import { describe, expect, it } from 'vitest';
import { getTokenCount, splitText } from '../splitText';
import computeSimilarity from '../computeSimilarity';
import formatChatHistoryAsString from '../formatHistory';

const paragraph = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `Sentence number ${i} talks about search engines. `,
  ).join('');

describe('splitText', () => {
  it('returns an empty list for empty text', () => {
    expect(splitText('')).toEqual([]);
  });

  it('keeps short text in a single chunk', () => {
    expect(splitText('One sentence. Two sentences.', 512, 64)).toEqual([
      'One sentence. Two sentences.',
    ]);
  });

  it('respects the token budget and adds overlap from the previous chunk', () => {
    const text = paragraph(60);
    const chunks = splitText(text, 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk except the overlap prefix fits the budget.
    chunks.forEach((c) => expect(getTokenCount(c)).toBeLessThanOrEqual(120));
    // Chunk n+1 starts with the tail of chunk n.
    for (let i = 1; i < chunks.length; i++) {
      const firstSentence = chunks[i].split('. ')[0];
      expect(chunks[i - 1]).toContain(firstSentence);
    }
    // Without the overlap the chunks rebuild the original text.
    expect(chunks.join('').length).toBeGreaterThanOrEqual(text.length);
  });

  it('puts a segment longer than the budget in a chunk of its own', () => {
    const long = 'x'.repeat(5000);
    const chunks = splitText(`short. ${long}`, 50, 0);
    expect(chunks).toEqual(['short. ', long]);
  });

  it('keeps the token sizes used for 4000/500 page chunking', () => {
    const chunks = splitText(paragraph(1200), 4000, 500);
    expect(chunks.map(getTokenCount)).toMatchInlineSnapshot(`
      [
        3601,
        4051,
        4061,
        641,
      ]
    `);
  });
});

describe('computeSimilarity', () => {
  it('computes the cosine similarity', () => {
    expect(computeSimilarity([1, 0], [1, 0])).toBe(1);
    expect(computeSimilarity([1, 0], [0, 1])).toBe(0);
    expect(computeSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2);
  });

  it('returns 0 for a zero vector and throws on length mismatch', () => {
    expect(computeSimilarity([0, 0], [1, 1])).toBe(0);
    expect(() => computeSimilarity([1], [1, 2])).toThrow();
  });
});

describe('formatChatHistoryAsString', () => {
  it('labels turns as User and AI', () => {
    expect(
      formatChatHistoryAsString([
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá' },
      ]),
    ).toBe('User: oi\nAI: olá');
  });
});
