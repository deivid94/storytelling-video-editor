import { describe, expect, it } from 'vitest';
import { formatClipDuration, formatResolution } from './clips';

describe('formatClipDuration', () => {
  it.each([
    [3.96, '3,9s'],
    [4, '4s'],
    [0.04, '0s'],
    [0.3, '0,3s'],
    [12.5, '12,5s'],
  ])('formatClipDuration(%s) = %s', (seconds, expected) => {
    expect(formatClipDuration(seconds)).toBe(expected);
  });
});

describe('formatResolution', () => {
  it('junta largura e altura com ×', () => {
    const video = { durationSeconds: 4, width: 720, height: 1280, fps: 30, lensType: null };
    expect(formatResolution(video)).toBe('720×1280');
  });
});
