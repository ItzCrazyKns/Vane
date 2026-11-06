import { describe, expect, it } from 'vitest';
import {
  MAX_FOLLOWED_TOPICS,
  followTopic,
  parseTopicPrefs,
  removeTopic,
} from '../clientTopics';

const empty = { hidden: [], followed: [] };

describe('Discover topic preferences', () => {
  it('ignores missing or malformed saved data', () => {
    expect(parseTopicPrefs(null)).toEqual(empty);
    expect(parseTopicPrefs('not json')).toEqual(empty);
    expect(
      parseTopicPrefs(
        JSON.stringify({ hidden: ['tech', 3], followed: [{ id: 1 }] }),
      ),
    ).toEqual({ hidden: ['tech'], followed: [] });
  });

  it('follows a subject once, trimming spaces', () => {
    const once = followTopic(empty, '  Copa   do Mundo ');
    expect(once.followed).toEqual([
      { id: 'q:copa do mundo', label: 'Copa do Mundo', query: 'Copa do Mundo' },
    ]);
    expect(followTopic(once, 'copa do mundo')).toBe(once);
    expect(followTopic(empty, '   ')).toBe(empty);
  });

  it('caps how many subjects can be followed', () => {
    let prefs = empty as ReturnType<typeof parseTopicPrefs>;
    for (let i = 0; i < MAX_FOLLOWED_TOPICS + 3; i++) {
      prefs = followTopic(prefs, `tema ${i}`);
    }
    expect(prefs.followed).toHaveLength(MAX_FOLLOWED_TOPICS);
  });

  it('removes a followed subject or hides a built-in topic', () => {
    const prefs = followTopic(empty, 'Pix');
    expect(removeTopic(prefs, 'q:pix').followed).toEqual([]);
    expect(removeTopic(prefs, 'tech').hidden).toEqual(['tech']);
  });
});
