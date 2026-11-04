import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HISTORY_TURNS, chatHistorySchema } from './chatHistory.ts';

test('keeps the most recent turns instead of rejecting a long chat', () => {
  const tuples: Array<[string, string]> = Array.from(
    { length: MAX_HISTORY_TURNS * 2 },
    (_, index) => ['human', `message ${index}`],
  );

  const parsed = chatHistorySchema.parse(tuples);

  assert.equal(parsed.length, MAX_HISTORY_TURNS);
  assert.deepEqual(parsed[0], ['human', `message ${MAX_HISTORY_TURNS}`]);
  assert.deepEqual(parsed[parsed.length - 1], [
    'human',
    `message ${MAX_HISTORY_TURNS * 2 - 1}`,
  ]);
});

test('keeps a short chat unchanged', () => {
  const tuples: Array<[string, string]> = [
    ['human', 'hello'],
    ['assistant', 'hi'],
  ];
  assert.deepEqual(chatHistorySchema.parse(tuples), tuples);
});

test('treats an absent history as empty', () => {
  assert.deepEqual(chatHistorySchema.parse(undefined), []);
});

test('still refuses an oversized array', () => {
  const tuples: Array<[string, string]> = Array.from({ length: 100001 }, () => [
    'human',
    'x',
  ]);
  const result = chatHistorySchema.safeParse(tuples);
  assert.equal(result.success, false);
});

test('refuses a tuple that is not a pair of strings', () => {
  assert.equal(chatHistorySchema.safeParse([['human']]).success, false);
  assert.equal(chatHistorySchema.safeParse([['human', 1]]).success, false);
});
