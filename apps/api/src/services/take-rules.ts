import { AppError } from '../errors/app-error.js';
import type { InterpretedTake, ScriptTake, TakeError } from '../types/project.js';

export const MAX_SCRIPT_LENGTH = 20_000;
export const MAX_TAKE_SECONDS = 60;

export function validateScriptText(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new AppError(400, 'O roteiro está vazio.');
  }
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    throw new AppError(400, 'O roteiro não tem texto, só símbolos ou emojis.');
  }
  if (trimmed.length > MAX_SCRIPT_LENGTH) {
    throw new AppError(400, 'O roteiro passa de 20.000 caracteres.');
  }
  return trimmed;
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function roundToOneDecimal(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

export function normalizeTakes(takes: InterpretedTake[]): ScriptTake[] {
  return takes.map((take, index) => ({
    ...take,
    number: index + 1,
    name: take.name.trim(),
    action: take.action.trim(),
    minSeconds: roundToOneDecimal(take.minSeconds),
    maxSeconds: roundToOneDecimal(take.maxSeconds),
    lens: emptyToNull(take.lens),
    distance: emptyToNull(take.distance),
    angle: emptyToNull(take.angle),
    notes: take.notes.map((note) => note.trim()).filter((note) => note !== ''),
  }));
}

function findDurationError(take: ScriptTake): TakeError | null {
  const { minSeconds, maxSeconds } = take;
  const error = (field: 'minSeconds' | 'maxSeconds', message: string): TakeError => ({
    takeNumber: take.number,
    field,
    message,
  });

  if (!Number.isFinite(minSeconds) || minSeconds <= 0) {
    return error('minSeconds', 'A duração mínima precisa ser maior que zero.');
  }
  if (!(maxSeconds >= minSeconds)) {
    return error('maxSeconds', 'A duração máxima não pode ser menor que a mínima.');
  }
  if (maxSeconds > MAX_TAKE_SECONDS) {
    return error('maxSeconds', 'Um take não pode passar de 60 segundos.');
  }
  return null;
}

function findTakeFieldErrors(take: ScriptTake, expectedNumber: number): TakeError[] {
  const errors: TakeError[] = [];
  const add = (field: keyof ScriptTake, message: string): void => {
    errors.push({ takeNumber: take.number, field, message });
  };

  if (take.number !== expectedNumber) {
    add('number', 'Os takes precisam estar numerados em sequência a partir de 1.');
  }
  if (take.name.trim() === '') {
    add('name', 'O nome do take é obrigatório.');
  }
  if (take.action.trim() === '') {
    add('action', 'Descreva a ação do take.');
  }
  const durationError = findDurationError(take);
  if (durationError) {
    errors.push(durationError);
  }
  return errors;
}

export function findTakeErrors(takes: ScriptTake[]): TakeError[] {
  return takes.flatMap((take, index) => findTakeFieldErrors(take, index + 1));
}
