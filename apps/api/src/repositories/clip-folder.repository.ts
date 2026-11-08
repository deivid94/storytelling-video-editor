import fs from 'node:fs/promises';
import { AppError } from '../errors/app-error.js';

export interface ClipFolderRepository {
  listFileNames(folder: string): Promise<string[]>; // só arquivos (sem subpastas), em ordem alfabética
}

export const FOLDER_NOT_FOUND_MESSAGE = 'A pasta não existe.';
export const NOT_A_FOLDER_MESSAGE = 'O caminho informado não é uma pasta.';
export const FOLDER_PERMISSION_MESSAGE = 'Sem permissão para ler a pasta.';

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function toAppError(error: unknown): unknown {
  switch (errorCode(error)) {
    case 'ENOENT':
      return new AppError(400, FOLDER_NOT_FOUND_MESSAGE);
    case 'ENOTDIR':
      return new AppError(400, NOT_A_FOLDER_MESSAGE);
    case 'EACCES':
    case 'EPERM':
      return new AppError(400, FOLDER_PERMISSION_MESSAGE);
    default:
      return error;
  }
}

export function createClipFolderRepository(): ClipFolderRepository {
  async function listFileNames(folder: string): Promise<string[]> {
    let entries;
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch (error) {
      throw toAppError(error);
    }
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  }

  return { listFileNames };
}
