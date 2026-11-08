import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error.js';
import {
  type ClipFolderRepository,
  createClipFolderRepository,
  FOLDER_NOT_FOUND_MESSAGE,
  FOLDER_PERMISSION_MESSAGE,
  NOT_A_FOLDER_MESSAGE,
} from '../../src/repositories/clip-folder.repository.js';

describe('createClipFolderRepository', () => {
  let tempDir: string;
  let folder: string;
  let repository: ClipFolderRepository;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clips-'));
    folder = path.join(tempDir, 'clipes');
    await fs.mkdir(folder);
    repository = createClipFolderRepository();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('lista só arquivos, ignorando subpastas', async () => {
    await fs.writeFile(path.join(folder, 'take2.mov'), '');
    await fs.writeFile(path.join(folder, 'take1.mov'), '');
    await fs.writeFile(path.join(folder, 'desktop.ini'), '');
    await fs.mkdir(path.join(folder, 'take3.mov'));

    await expect(repository.listFileNames(folder)).resolves.toEqual([
      'desktop.ini',
      'take1.mov',
      'take2.mov',
    ]);
  });

  it('pasta vazia devolve lista vazia', async () => {
    await expect(repository.listFileNames(folder)).resolves.toEqual([]);
  });

  it('pasta que não existe rejeita com AppError 400', async () => {
    const missing = path.join(tempDir, 'nao-existe');

    const promise = repository.listFileNames(missing);

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: FOLDER_NOT_FOUND_MESSAGE,
    });
  });

  it('caminho que é arquivo rejeita com AppError 400', async () => {
    const file = path.join(folder, 'take1.mov');
    await fs.writeFile(file, '');

    const promise = repository.listFileNames(file);

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: NOT_A_FOLDER_MESSAGE,
    });
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'pasta sem permissão rejeita com AppError 400',
    async () => {
      await fs.chmod(folder, 0o000);

      try {
        const promise = repository.listFileNames(folder);

        await expect(promise).rejects.toBeInstanceOf(AppError);
        await expect(promise).rejects.toMatchObject({
          status: 400,
          message: FOLDER_PERMISSION_MESSAGE,
        });
      } finally {
        await fs.chmod(folder, 0o700);
      }
    },
  );
});
