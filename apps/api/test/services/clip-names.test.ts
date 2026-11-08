import { describe, expect, it } from 'vitest';
import {
  clipLabel,
  NAME_PATTERN_REASON,
  parseClipFileName,
  TAKE_ZERO_REASON,
  UNSUPPORTED_EXTENSION_REASON,
} from '../../src/services/clip-names.js';

describe('parseClipFileName', () => {
  it.each([
    ['take1.mov', { ok: true, takeNumber: 1, attempt: null }],
    ['TAKE3B.MP4', { ok: true, takeNumber: 3, attempt: 'b' }],
    ['Take12a.Mov', { ok: true, takeNumber: 12, attempt: 'a' }],
    ['take01.mp4', { ok: true, takeNumber: 1, attempt: null }],
    ['take0.mov', { ok: false, reason: TAKE_ZERO_REASON }],
    ['take-1.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['take3ab.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['take1000.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['take 1.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['take1 (1).mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['._take1.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['A001_11051828_C019.mov', { ok: false, reason: NAME_PATTERN_REASON }],
    ['take1.mkv', { ok: false, reason: UNSUPPORTED_EXTENSION_REASON }],
    ['take1.mov.part', { ok: false, reason: UNSUPPORTED_EXTENSION_REASON }],
    ['take1', { ok: false, reason: UNSUPPORTED_EXTENSION_REASON }],
    ['desktop.ini', { ok: false, reason: UNSUPPORTED_EXTENSION_REASON }],
  ])('%s', (fileName, expected) => {
    expect(parseClipFileName(fileName)).toEqual(expected);
  });
});

describe('clipLabel', () => {
  it('junta o número e a tentativa', () => {
    expect(clipLabel(3, 'a')).toBe('take3a');
  });

  it('omite a tentativa quando é null', () => {
    expect(clipLabel(3, null)).toBe('take3');
  });
});
