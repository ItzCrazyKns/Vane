import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTopicItems: vi.fn(),
  getKeywordItems: vi.fn(),
}));

vi.mock('@/lib/discover/fetchTopic', () => mocks);

import { GET } from '../route';

const call = (query: string) =>
  GET(new Request(`http://localhost/api/discover?${query}`));

describe('GET /api/discover', () => {
  beforeEach(() => {
    mocks.getTopicItems.mockReset().mockResolvedValue([{ title: 't' }]);
    mocks.getKeywordItems.mockReset().mockResolvedValue([{ title: 'k' }]);
  });

  it('serves a built-in topic for the requested language', async () => {
    const res = await call('topic=finance&lang=en');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blogs: [{ title: 't' }] });
    const [topic, locale] = mocks.getTopicItems.mock.calls[0];
    expect(topic.id).toBe('finance');
    expect(locale).toBe('en');
  });

  it('defaults to Portuguese and the first topic', async () => {
    await call('mode=preview');
    const [topic, locale] = mocks.getTopicItems.mock.calls[0];
    expect(locale).toBe('pt-BR');
    expect(topic.id).toBe('tech');
  });

  it('rejects an unknown topic', async () => {
    expect((await call('topic=nope')).status).toBe(400);
  });

  it('searches a followed subject', async () => {
    const res = await call('q=%20Pix%20&lang=pt-BR');
    expect(await res.json()).toEqual({ blogs: [{ title: 'k' }] });
    expect(mocks.getKeywordItems).toHaveBeenCalledWith('Pix', 'pt-BR');
  });

  it('rejects a subject that is too long', async () => {
    expect((await call(`q=${'a'.repeat(81)}`)).status).toBe(400);
  });

  it('returns 500 when loading fails', async () => {
    mocks.getTopicItems.mockRejectedValue(new Error('down'));
    expect((await call('topic=tech')).status).toBe(500);
  });
});
