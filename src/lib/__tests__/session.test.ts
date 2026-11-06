import { describe, expect, it } from 'vitest';
import SessionManager from '../session';
import { TextBlock } from '../types';

describe('SessionManager', () => {
  it('applies JSON patches to blocks and replays past events to late subscribers', () => {
    const session = SessionManager.createSession();
    const block: TextBlock = { id: 'b1', type: 'text', data: 'Olá' };

    session.emitBlock(block);
    session.updateBlock('b1', [
      { op: 'replace', path: '/data', value: 'Olá mundo' },
    ]);
    session.emit('end', {});

    expect((session.getBlock('b1') as TextBlock).data).toBe('Olá mundo');
    expect(SessionManager.getSession(session.id)).toBe(session);

    const seen: string[] = [];
    const unsubscribe = session.subscribe((event, data) =>
      seen.push(`${event}:${data.type ?? ''}`),
    );
    expect(seen).toEqual(['data:block', 'data:updateBlock', 'end:']);

    session.emit('data', { type: 'researchComplete' });
    expect(seen.at(-1)).toBe('data:researchComplete');

    unsubscribe();
    session.emit('data', { type: 'after' });
    expect(seen.at(-1)).toBe('data:researchComplete');
  });
});
