import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HISTORY_INPUT_TUPLES,
  MAX_HISTORY_TURNS,
  chatHistorySchema,
} from './chatHistory.ts';

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

test('keeps only the most recent window of a long history', () => {
  const tuples: Array<[string, string]> = Array.from(
    { length: MAX_HISTORY_INPUT_TUPLES },
    (_, index) => ['human', `message ${index}`],
  );

  const parsed = chatHistorySchema.parse(tuples);

  assert.equal(parsed.length, MAX_HISTORY_TURNS);
  assert.deepEqual(parsed[0], [
    'human',
    `message ${MAX_HISTORY_INPUT_TUPLES - MAX_HISTORY_TURNS}`,
  ]);
});

test('truncates before tuple validation so a malformed array stays bounded', () => {
  const malformed = Array.from(
    { length: MAX_HISTORY_INPUT_TUPLES - 1 },
    () => 'not a tuple',
  );

  const result = chatHistorySchema.safeParse(malformed);

  assert.equal(result.success, false);
  assert.ok(result.error.issues.length <= MAX_HISTORY_TURNS);
  assert.ok(result.error.issues.length > 0);
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
  const tuples: Array<[string, string]> = Array.from(
    { length: MAX_HISTORY_INPUT_TUPLES + 1 },
    () => ['human', 'x'],
  );
  const result = chatHistorySchema.safeParse(tuples);
  assert.equal(result.success, false);
});

test('refuses a tuple that is not a pair of strings', () => {
  assert.equal(chatHistorySchema.safeParse([['human']]).success, false);
  assert.equal(chatHistorySchema.safeParse([['human', 1]]).success, false);
});
