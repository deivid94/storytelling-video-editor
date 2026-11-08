import type { VideoInfo } from '../api/projects';

// Igual ao formatSecondsShort da API: 3.96 -> "3,9s" (trunca em uma casa, vírgula decimal).
export function formatClipDuration(seconds: number): string {
  // O epsilon evita que 0.3 * 10 = 2.9999... perca uma casa.
  const rounded = Math.floor(seconds * 10 + 1e-9) / 10;
  return `${String(rounded).replace('.', ',')}s`;
}

export function formatResolution(video: VideoInfo): string {
  return `${video.width}×${video.height}`;
}
