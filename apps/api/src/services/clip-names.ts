import path from 'node:path';

export type ClipNameResult =
  { ok: true; takeNumber: number; attempt: string | null } | { ok: false; reason: string };

export const UNSUPPORTED_EXTENSION_REASON = 'Extensão não suportada (use .mov ou .mp4).';
export const NAME_PATTERN_REASON = 'Nome fora do padrão (ex.: take1.mov, take3a.mp4).';
export const TAKE_ZERO_REASON = 'Os takes começam em 1 (take0 não existe).';

const SUPPORTED_EXTENSIONS = ['.mov', '.mp4'];
const NAME_PATTERN = /^take(\d{1,3})([a-z])?$/i;

// Lê o nome de um arquivo de clipe: "take3b.mov" -> take 3, tentativa "b".
export function parseClipFileName(fileName: string): ClipNameResult {
  const extension = path.extname(fileName);
  if (!SUPPORTED_EXTENSIONS.includes(extension.toLowerCase())) {
    return { ok: false, reason: UNSUPPORTED_EXTENSION_REASON };
  }

  const match = NAME_PATTERN.exec(path.basename(fileName, extension));
  if (!match) {
    return { ok: false, reason: NAME_PATTERN_REASON };
  }

  const takeNumber = Number(match[1]);
  if (takeNumber === 0) {
    return { ok: false, reason: TAKE_ZERO_REASON };
  }

  const attempt = match[2] ? match[2].toLowerCase() : null;
  return { ok: true, takeNumber, attempt };
}

// (3, 'a') -> "take3a"; (3, null) -> "take3"
export function clipLabel(takeNumber: number, attempt: string | null): string {
  return `take${takeNumber}${attempt ?? ''}`;
}
