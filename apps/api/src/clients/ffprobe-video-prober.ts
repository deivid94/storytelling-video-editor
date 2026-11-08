import { execFile } from 'node:child_process';
import { AppError } from '../errors/app-error.js';
import type { VideoInfo } from '../types/clip.js';
import { VideoProbeError, type VideoProber } from './video-prober.js';

export const FFPROBE_NOT_FOUND_MESSAGE =
  'ffprobe não encontrado. Instale o ffmpeg e deixe o ffprobe no PATH (ou defina FFPROBE_PATH).';
export const UNREADABLE_VIDEO_MESSAGE =
  'Não foi possível ler o arquivo: não é vídeo ou está corrompido.';
export const NO_VIDEO_STREAM_MESSAGE = 'O arquivo não tem imagem de vídeo.';
export const PROBE_TIMEOUT_MESSAGE = 'A leitura do vídeo demorou demais.';

const DEFAULT_TIMEOUT_MS = 15000;
const LENS_TAG = 'com.blackmagic-design.camera.lensType';

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  side_data_list?: { rotation?: number }[];
}

interface ProbeOutput {
  format?: { duration?: string; tags?: Record<string, string> };
  streams?: ProbeStream[];
}

// Códigos de quando o ffprobe não pode ser iniciado: não existe, é uma pasta ou não é executável.
// No Windows, um arquivo que não é programa dá EFTYPE.
const SPAWN_FAILURE_CODES = ['ENOENT', 'EACCES', 'EISDIR', 'EPERM', 'EFTYPE'];

function isSpawnFailure(error: NodeJS.ErrnoException): boolean {
  return SPAWN_FAILURE_CODES.includes(error.code ?? '');
}

function runFfprobe(ffprobePath: string, filePath: string, timeoutMs: number): Promise<string> {
  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_entries',
    'format=duration:format_tags:stream=codec_type,width,height,r_frame_rate:stream_side_data=rotation',
    filePath,
  ];
  return new Promise((resolve, reject) => {
    const onDone = (error: Error | null, stdout: string): void => {
      if (!error) {
        resolve(stdout);
        return;
      }
      const failure = error as NodeJS.ErrnoException & { killed?: boolean };
      if (isSpawnFailure(failure)) {
        reject(new AppError(500, FFPROBE_NOT_FOUND_MESSAGE));
      } else if (failure.killed) {
        reject(new VideoProbeError(PROBE_TIMEOUT_MESSAGE, { cause: error }));
      } else {
        reject(new VideoProbeError(UNREADABLE_VIDEO_MESSAGE, { cause: error }));
      }
    };
    // Em alguns casos (ex.: EFTYPE no Windows) o execFile lança na hora, sem chamar o callback.
    try {
      execFile(ffprobePath, args, { timeout: timeoutMs }, onDone);
    } catch (error) {
      onDone(error as Error, '');
    }
  });
}

function parseOutput(stdout: string): ProbeOutput {
  try {
    return JSON.parse(stdout) as ProbeOutput;
  } catch (error) {
    throw new VideoProbeError(UNREADABLE_VIDEO_MESSAGE, { cause: error });
  }
}

// "60/1" -> 60. Divisão por zero ou texto estranho -> 0.
function parseFrameRate(rate: string | undefined): number {
  const [numerator, denominator] = (rate ?? '').split('/').map(Number);
  if (!numerator || !denominator) return 0;
  return numerator / denominator;
}

function isQuarterTurn(stream: ProbeStream): boolean {
  const rotation = stream.side_data_list?.find((data) => data.rotation !== undefined)?.rotation;
  if (rotation === undefined) return false;
  return Math.abs(rotation) % 180 === 90;
}

function readDuration(output: ProbeOutput): number {
  const duration = Number(output.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VideoProbeError(UNREADABLE_VIDEO_MESSAGE);
  }
  return duration;
}

function findVideoStream(output: ProbeOutput): ProbeStream & { width: number; height: number } {
  const stream = output.streams?.find((item) => item.codec_type === 'video');
  if (!stream?.width || !stream.height) {
    throw new VideoProbeError(NO_VIDEO_STREAM_MESSAGE);
  }
  return { ...stream, width: stream.width, height: stream.height };
}

function toVideoInfo(output: ProbeOutput): VideoInfo {
  const durationSeconds = readDuration(output);
  const stream = findVideoStream(output);
  const swap = isQuarterTurn(stream);
  return {
    durationSeconds,
    width: swap ? stream.height : stream.width,
    height: swap ? stream.width : stream.height,
    fps: parseFrameRate(stream.r_frame_rate),
    lensType: output.format?.tags?.[LENS_TAG] ?? null,
  };
}

export function createFfprobeVideoProber(options: {
  ffprobePath: string;
  timeoutMs?: number;
}): VideoProber {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async probe(filePath) {
      const stdout = await runFfprobe(options.ffprobePath, filePath, timeoutMs);
      return toVideoInfo(parseOutput(stdout));
    },
  };
}
