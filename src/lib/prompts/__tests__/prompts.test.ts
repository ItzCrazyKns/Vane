import { beforeAll, describe, expect, it, vi } from 'vitest';

/* Snapshots of every prompt, so any change to wording, order or the
   variable parts shows up in review and must pass the quality eval. */

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
});

describe('prompts', () => {
  it('classifier', async () => {
    const { classifierPrompt } = await import('../search/classifier');
    expect(classifierPrompt).toMatchSnapshot();
  });

  it.each(['speed', 'balanced', 'quality'] as const)(
    'researcher (%s)',
    async (mode) => {
      const { getResearcherPrompt } = await import('../search/researcher');
      expect(
        getResearcherPrompt('<tool name="x">desc</tool>', mode, 0, 6, []),
      ).toMatchSnapshot();
    },
  );

  it('researcher prompt changes between iterations (cache-relevant)', async () => {
    const { getResearcherPrompt } = await import('../search/researcher');
    const a = getResearcherPrompt('d', 'balanced', 0, 6, []);
    const b = getResearcherPrompt('d', 'balanced', 1, 6, []);
    let i = 0;
    while (a[i] === b[i]) i++;
    // The first difference sits in the opening lines (iteration counter).
    expect(a.slice(0, i).split('\n').length).toBeLessThan(10);
  });

  it.each([
    ['speed', false],
    ['quality', false],
    ['balanced', true],
  ] as const)('writer (%s, skipSearch=%s)', async (mode, skip) => {
    const { getWriterPrompt } = await import('../search/writer');
    expect(
      getWriterPrompt('<ctx/>', 'Seja breve.', mode, skip),
    ).toMatchSnapshot();
  });

  it('suggestions', async () => {
    const { suggestionGeneratorPrompt } = await import('../suggestions');
    // The date inside is computed once, when the module loads.
    expect(
      suggestionGeneratorPrompt.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/, '<date>'),
    ).toMatchSnapshot();
  });

  it('media', async () => {
    const image = await import('../media/image');
    const video = await import('../media/videos');
    expect({ image, video }).toMatchSnapshot();
  });
});
