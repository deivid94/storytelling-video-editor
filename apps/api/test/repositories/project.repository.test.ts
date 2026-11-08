import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error.js';
import {
  createFileProjectRepository,
  type ProjectRepository,
} from '../../src/repositories/project.repository.js';
import type { Project } from '../../src/types/project.js';

describe('createFileProjectRepository', () => {
  let dataDir: string;
  let repository: ProjectRepository;
  let project: Project;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-'));
    repository = createFileProjectRepository(dataDir);
    project = {
      id: crypto.randomUUID(),
      createdAt: '2026-11-06T10:00:00.000Z',
      scriptText: 'Take 1: abertura',
      takes: [
        {
          number: 1,
          name: 'Abertura',
          minSeconds: 2,
          maxSeconds: 5,
          action: 'Olhar para a câmera',
          framing: 'close',
          lens: null,
          distance: null,
          angle: null,
          hasExecution: true,
          notes: [],
        },
      ],
      interpretationError: null,
      clipScan: null,
    };
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('salva e lê o mesmo projeto', async () => {
    await repository.save(project);
    expect(await repository.findById(project.id)).toEqual(project);
  });

  it('grava em projects/<id>/project.json', async () => {
    await repository.save(project);
    const file = path.join(dataDir, 'projects', project.id, 'project.json');
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(project);
  });

  it('sobrescreve ao salvar de novo', async () => {
    await repository.save(project);
    await repository.save({ ...project, takes: [] });
    expect((await repository.findById(project.id))?.takes).toEqual([]);
  });

  it('devolve null para projeto que não existe', async () => {
    expect(await repository.findById(crypto.randomUUID())).toBeNull();
  });

  it.each(['../../etc/passwd', '..', 'abc', '', `${crypto.randomUUID()}/../x`])(
    'devolve null para id inválido %j sem tocar no disco fora da pasta',
    async (id) => {
      expect(await repository.findById(id)).toBeNull();
    },
  );

  it('acusa projeto corrompido com AppError 500', async () => {
    const dir = path.join(dataDir, 'projects', project.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'project.json'), '{ quebrado');
    await expect(repository.findById(project.id)).rejects.toThrow(
      new AppError(500, 'O arquivo do projeto está corrompido.'),
    );
  });

  it('não deixa arquivo temporário para trás', async () => {
    await repository.save(project);
    expect(await fs.readdir(path.join(dataDir, 'projects', project.id))).toEqual(['project.json']);
  });

  it('projeto salvo sem clipScan abre com clipScan null', async () => {
    const legacy: Partial<Project> = { ...project };
    delete legacy.clipScan;
    const dir = path.join(dataDir, 'projects', project.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(legacy));
    expect(await repository.findById(project.id)).toEqual({ ...legacy, clipScan: null });
  });
});
