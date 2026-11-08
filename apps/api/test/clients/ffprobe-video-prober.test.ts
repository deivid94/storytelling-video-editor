import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createFfprobeVideoProber,
  FFPROBE_NOT_FOUND_MESSAGE,
  NO_VIDEO_STREAM_MESSAGE,
  PROBE_TIMEOUT_MESSAGE,
  UNREADABLE_VIDEO_MESSAGE,
} from '../../src/clients/ffprobe-video-prober.js';
import { VideoProbeError } from '../../src/clients/video-prober.js';
import { AppError } from '../../src/errors/app-error.js';

function fixture(name: string): string {
  return path.resolve(import.meta.dirname, '../../../../fixtures/videos', name);
}

describe('createFfprobeVideoProber', () => {
  const prober = createFfprobeVideoProber({ ffprobePath: 'ffprobe' });

  it('lê o clipe vertical com rotação e a lente', async () => {
    const info = await prober.probe(fixture('vertical-rotated-52mm.mp4'));
    expect(info).toMatchObject({
      width: 180,
      height: 320,
      fps: 60,
      lensType: 'iPhone 14 Pro Max 52mm',
    });
    expect(info.durationSeconds).toBeCloseTo(1.5, 1);
  });

  it('lê clipe sem rotação e sem lente', async () => {
    const info = await prober.probe(fixture('vertical-plain.mp4'));
    expect(info).toMatchObject({ width: 180, height: 320, lensType: null });
    expect(info.durationSeconds).toBeCloseTo(2, 1);
  });

  it.each([
    ['not-a-video.mp4', UNREADABLE_VIDEO_MESSAGE],
    ['truncated.mp4', UNREADABLE_VIDEO_MESSAGE],
    ['audio-only.mp4', NO_VIDEO_STREAM_MESSAGE],
    ['nao-existe.mp4', UNREADABLE_VIDEO_MESSAGE],
  ])('%s vira VideoProbeError', async (name, message) => {
    await expect(prober.probe(fixture(name))).rejects.toEqual(new VideoProbeError(message));
  });

  it('ffprobe ausente vira AppError 500 com a mensagem de instalação', async () => {
    const missing = createFfprobeVideoProber({ ffprobePath: 'ffprobe-que-nao-existe' });
    await expect(missing.probe(fixture('vertical-plain.mp4'))).rejects.toEqual(
      new AppError(500, FFPROBE_NOT_FOUND_MESSAGE),
    );
  });

  it('timeout vira VideoProbeError', async () => {
    const slow = createFfprobeVideoProber({ ffprobePath: 'ffprobe', timeoutMs: 1 });
    await expect(slow.probe(fixture('vertical-plain.mp4'))).rejects.toEqual(
      new VideoProbeError(PROBE_TIMEOUT_MESSAGE),
    );
  });
});
