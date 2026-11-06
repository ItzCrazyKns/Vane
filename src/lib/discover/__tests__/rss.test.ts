import { describe, expect, it } from 'vitest';
import { decodeFeed, parseFeed, unwrapLink } from '../rss';

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Feed</title>
    <item>
      <title><![CDATA[Nova lei de IA &amp; dados]]></title>
      <link>https://g1.globo.com/tecnologia/noticia/ia.ghtml</link>
      <description><![CDATA[<img src="https://s2.glbimg.com/foto.jpg" /><p>Texto <b>importante</b> da notícia.</p>]]></description>
      <pubDate>Thu, 05 Nov 2026 12:00:00 -0300</pubDate>
    </item>
    <item>
      <title>Com media:content</title>
      <link>https://www.tecmundo.com.br/a</link>
      <media:content url="https://img.tecmundo.com.br/a.jpg" medium="image" />
      <description>Resumo</description>
    </item>
    <item>
      <title>Sem link</title>
      <description>ignorado</description>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom entry</title>
    <link rel="replies" href="https://example.com/comments" />
    <link rel="alternate" href="https://example.com/post" />
    <summary>Hello &lt;em&gt;world&lt;/em&gt;</summary>
    <updated>2026-11-04T10:00:00Z</updated>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('reads RSS items: text, image from the description, date and host', () => {
    const items = parseFeed(rss);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'Nova lei de IA & dados',
      url: 'https://g1.globo.com/tecnologia/noticia/ia.ghtml',
      content: 'Texto importante da notícia.',
      thumbnail: 'https://s2.glbimg.com/foto.jpg',
      source: 'g1.globo.com',
      publishedAt: '2026-11-05T15:00:00.000Z',
    });
    expect(items[1].thumbnail).toBe('https://img.tecmundo.com.br/a.jpg');
    expect(items[1].source).toBe('tecmundo.com.br');
    expect(items[1].publishedAt).toBeUndefined();
  });

  it('reads Atom entries using the alternate link', () => {
    const [entry] = parseFeed(atom);
    expect(entry.url).toBe('https://example.com/post');
    expect(entry.content).toBe('Hello world');
    expect(entry.publishedAt).toBe('2026-11-04T10:00:00.000Z');
    expect(entry.thumbnail).toBeUndefined();
  });

  it('returns nothing for a document that is not a feed', () => {
    expect(parseFeed('<html><body>oops</body></html>')).toEqual([]);
  });
});

describe('unwrapLink', () => {
  it('removes the Folha tracking redirect', () => {
    expect(
      unwrapLink(
        'https://redir.folha.com.br/redir/online/mercado/rss091/*https://www1.folha.uol.com.br/mercado/2026/11/x.shtml',
      ),
    ).toBe('https://www1.folha.uol.com.br/mercado/2026/11/x.shtml');
    expect(unwrapLink('https://example.com/a')).toBe('https://example.com/a');
  });
});

describe('decodeFeed', () => {
  it('decodes ISO-8859-1 feeds declared in the XML prolog', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><t>Ação</t>';
    const bytes = Uint8Array.from(Array.from(xml).map((c) => c.charCodeAt(0)));
    expect(decodeFeed(bytes.buffer)).toContain('Ação');
  });

  it('defaults to UTF-8', () => {
    const bytes = new TextEncoder().encode('<t>Ação</t>');
    expect(decodeFeed(bytes.buffer as ArrayBuffer)).toBe('<t>Ação</t>');
  });
});
