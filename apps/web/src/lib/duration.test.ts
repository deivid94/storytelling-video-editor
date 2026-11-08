import { describe, expect, it } from 'vitest';
import { formatDurationRange, parseSecondsInput } from './duration';

describe('parseSecondsInput', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['1,5', 1.5],
    [' 3 ', 3],
    ['0', 0],
    ['-1', -1],
  ])('parseSecondsInput(%j) = %s', (value, expected) => {
    expect(parseSecondsInput(value)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '😀', '1,5,2', '1.2.3', 'Infinity'])(
    'parseSecondsInput(%j) = null',
    (value) => {
      expect(parseSecondsInput(value)).toBeNull();
    },
  );
});

describe('formatDurationRange', () => {
  it.each([
    [2, 2, '2s'],
    [1, 2, '1–2s'],
    [1.5, 2.5, '1,5–2,5s'],
  ])('formatDurationRange(%s, %s) = %s', (min, max, text) => {
    expect(formatDurationRange(min, max)).toBe(text);
  });
});
