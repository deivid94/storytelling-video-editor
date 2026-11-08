const SECONDS_PATTERN = /^-?\d+(\.\d+)?$/;

/** Converte o texto digitado ("1,5" ou "1.5") em segundos. Devolve null se não for um número válido. */
export function parseSecondsInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!SECONDS_PATTERN.test(normalized)) return null;
  return Number(normalized);
}

function formatSeconds(seconds: number): string {
  return String(seconds).replace('.', ',');
}

/** Ex.: (2, 2) -> "2s"; (1, 2) -> "1–2s"; (1.5, 2.5) -> "1,5–2,5s". */
export function formatDurationRange(minSeconds: number, maxSeconds: number): string {
  if (minSeconds === maxSeconds) return `${formatSeconds(minSeconds)}s`;
  return `${formatSeconds(minSeconds)}–${formatSeconds(maxSeconds)}s`;
}
