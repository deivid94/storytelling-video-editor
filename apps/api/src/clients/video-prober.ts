import type { VideoInfo } from '../types/clip.js';

// Erro para arquivo que não é vídeo, está corrompido ou demorou demais para ser lido.
export class VideoProbeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VideoProbeError';
  }
}

export interface VideoProber {
  probe(filePath: string): Promise<VideoInfo>;
}
