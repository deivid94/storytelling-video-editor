import path from 'node:path';
import { AppError } from '../errors/app-error.js';
import type {
  ClipMapping,
  ClipScan,
  ClipWarning,
  MappedClip,
  ScannedClip,
  TakeClips,
  TakeClipsWarning,
} from '../types/clip.js';
import type { ScriptTake } from '../types/project.js';
import { clipLabel } from './clip-names.js';

export const MIN_EXPORT_SHORT_SIDE = 1080;

const LENS_PATTERN = /(\d+(?:[.,]\d+)?)\s*mm/i;

// Limpa o que o usuário digitou: espaços e um par de aspas duplas em volta.
export function normalizeFolderInput(text: string): string {
  let folder = text.trim();
  if (folder.length >= 2 && folder.startsWith('"') && folder.endsWith('"')) {
    folder = folder.slice(1, -1).trim();
  }
  if (folder === '') {
    throw new AppError(400, 'Informe a pasta dos clipes.');
  }
  // Caminho de rede (UNC): o Windows tentaria entrar em outro computador.
  if (folder.startsWith('\\') || folder.startsWith('//')) {
    throw new AppError(400, 'Use uma pasta deste computador, não um caminho de rede.');
  }
  if (!path.isAbsolute(folder)) {
    throw new AppError(400, 'Use o caminho completo da pasta (ex.: D:\\Videos\\treino).');
  }
  return folder;
}

// Arredonda PARA BAIXO em 1 casa: 3.96 -> "3,9s"; 4 -> "4s".
export function formatSecondsShort(seconds: number): string {
  // O epsilon evita que 0.3 * 10 = 2.9999... perca uma casa.
  const rounded = Math.floor(seconds * 10 + 1e-9) / 10;
  return `${String(rounded).replace('.', ',')}s`;
}

// "iPhone 14 Pro Max 24mm" -> 24; "0.5x" -> null
export function lensMillimeters(text: string | null): number | null {
  if (text === null) {
    return null;
  }
  const match = LENS_PATTERN.exec(text);
  return match?.[1] ? Number(match[1].replace(',', '.')) : null;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Ordem: número do take, tentativa (sem letra primeiro), nome do arquivo.
function compareClips(a: ScannedClip, b: ScannedClip): number {
  return (
    a.takeNumber - b.takeNumber ||
    compareText(a.attempt ?? '', b.attempt ?? '') ||
    compareText(a.fileName, b.fileName)
  );
}

function findClipWarnings(clip: ScannedClip, take: ScriptTake | null): ClipWarning[] {
  const { video } = clip;
  if (video === null) {
    return [{ code: 'unreadable', message: clip.readError ?? 'Não foi possível ler o arquivo.' }];
  }
  if (take === null) {
    return [];
  }

  const warnings: ClipWarning[] = [];
  if (video.durationSeconds < take.minSeconds) {
    warnings.push({
      code: 'too-short',
      message: `O clipe tem ${formatSecondsShort(video.durationSeconds)}, menos que o mínimo do take (${formatSecondsShort(take.minSeconds)}).`,
    });
  }

  const takeMm = lensMillimeters(take.lens);
  const clipMm = lensMillimeters(video.lensType);
  if (takeMm !== null && clipMm !== null && takeMm !== clipMm) {
    warnings.push({
      code: 'lens-mismatch',
      message: `Lente do clipe (${clipMm}mm) diferente da do roteiro (${takeMm}mm).`,
    });
  }
  return warnings;
}

function findAttemptGap(takeNumber: number, clips: ScannedClip[]): TakeClipsWarning[] {
  const letters = clips.flatMap((clip) => (clip.attempt === null ? [] : [clip.attempt]));
  if (letters.length === 0) {
    return [];
  }

  const highest = letters.reduce((max, letter) => (letter > max ? letter : max));
  const missing: string[] = [];
  for (let code = 'a'.charCodeAt(0); code <= highest.charCodeAt(0); code += 1) {
    const letter = String.fromCharCode(code);
    if (!letters.includes(letter)) {
      missing.push(clipLabel(takeNumber, letter));
    }
  }
  if (missing.length === 0) {
    return [];
  }
  return [{ code: 'attempt-gap', message: `Tentativa faltando: ${missing.join(', ')}.` }];
}

function findDuplicates(clips: ScannedClip[]): TakeClipsWarning[] {
  const fileNamesByLabel = new Map<string, string[]>();
  for (const clip of clips) {
    const label = clipLabel(clip.takeNumber, clip.attempt);
    fileNamesByLabel.set(label, [...(fileNamesByLabel.get(label) ?? []), clip.fileName]);
  }

  const warnings: TakeClipsWarning[] = [];
  for (const [label, fileNames] of fileNamesByLabel) {
    if (fileNames.length > 1) {
      warnings.push({
        code: 'duplicate',
        message: `Mais de um arquivo para ${label}: ${fileNames.join(', ')}.`,
      });
    }
  }
  return warnings;
}

function findTakeWarnings(takeNumber: number, clips: ScannedClip[]): TakeClipsWarning[] {
  if (clips.length === 0) {
    return [{ code: 'missing', message: 'Nenhum clipe para este take.' }];
  }
  const noReadable = clips.every((clip) => clip.video === null)
    ? ([{ code: 'no-readable-clip', message: 'Nenhum clipe legível para este take.' }] as const)
    : [];
  return [...noReadable, ...findAttemptGap(takeNumber, clips), ...findDuplicates(clips)];
}

function buildNotices(scan: ClipScan): string[] {
  if (scan.clips.length === 0) {
    return ['A pasta não tem nenhum clipe com nome take<N> (ex.: take1.mov).'];
  }
  const lowResolution = scan.clips.filter(
    (clip) =>
      clip.video !== null && Math.min(clip.video.width, clip.video.height) < MIN_EXPORT_SHORT_SIDE,
  ).length;
  if (lowResolution === 0) {
    return [];
  }
  return [
    `${lowResolution} clipe(s) com menos de ${MIN_EXPORT_SHORT_SIDE} pixels no lado menor: a exportação vai sair ampliada.`,
  ];
}

function mapClip(clip: ScannedClip, take: ScriptTake | null): MappedClip {
  return { ...clip, warnings: findClipWarnings(clip, take) };
}

function mapTake(take: ScriptTake, sortedClips: ScannedClip[]): TakeClips {
  const clips = sortedClips.filter((clip) => clip.takeNumber === take.number);
  return {
    takeNumber: take.number,
    clips: clips.map((clip) => mapClip(clip, take)),
    warnings: findTakeWarnings(take.number, clips),
  };
}

// Liga cada take do roteiro aos clipes da pasta e junta os avisos.
export function buildClipMapping(takes: ScriptTake[], scan: ClipScan): ClipMapping {
  const sortedClips = [...scan.clips].sort(compareClips);
  const scriptNumbers = new Set(takes.map((take) => take.number));

  return {
    folder: scan.folder,
    scannedAt: scan.scannedAt,
    takes: takes.map((take) => mapTake(take, sortedClips)),
    orphanClips: sortedClips
      .filter((clip) => !scriptNumbers.has(clip.takeNumber))
      .map((clip) => mapClip(clip, null)),
    ignoredFiles: scan.ignoredFiles,
    notices: buildNotices(scan),
  };
}
