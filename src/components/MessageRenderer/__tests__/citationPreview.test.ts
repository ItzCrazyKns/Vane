/* Suggestion 22 of the Perplexity comparison: hovering a citation shows
   the source it points to. */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Citation, {
  CitationSourcesContext,
  PREVIEW_CHARS,
  previewText,
} from '../Citation';

const sources = [
  {
    content: 'Primeira fonte   com\n espaços.',
    metadata: {
      title: 'Fonte A',
      url: 'https://www.a.test/x',
      publishedDate: '2026-10-30',
    },
  },
  { content: 'Segunda', metadata: { title: 'Fonte B', url: 'https://b.test' } },
];

const render = (n: string, href: string) =>
  renderToStaticMarkup(
    createElement(
      CitationSourcesContext.Provider,
      { value: sources },
      createElement(Citation, { href }, n),
    ),
  );

describe('previewText', () => {
  it('collapses spaces and cuts long text', () => {
    expect(previewText('a  b\n c')).toBe('a b c');
    const long = 'x'.repeat(PREVIEW_CHARS + 50);
    expect(previewText(long)).toHaveLength(PREVIEW_CHARS + 1);
    expect(previewText(long).endsWith('…')).toBe(true);
    expect(previewText(undefined)).toBe('');
  });
});

describe('Citation', () => {
  it('shows the site, date, title and text of the cited source', () => {
    const html = render('1', 'https://www.a.test/x');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('a.test');
    expect(html).toContain('2026-10-30');
    expect(html).toContain('Fonte A');
    expect(html).toContain('Primeira fonte com espaços.');
    expect(html).toContain('href="https://www.a.test/x"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('points at the right source by number', () => {
    expect(render('2', 'https://b.test')).toContain('Fonte B');
  });

  it('renders a plain link when the source is unknown', () => {
    const html = render('9', 'https://c.test');
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('href="https://c.test"');
  });

  it('does not render an unsafe href', () => {
    expect(render('1', 'javascript:alert(1)')).not.toContain('javascript:');
  });
});
