import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeScriptInterpreter,
  FAKE_TAKES,
} from '../../src/clients/fake-script-interpreter.js';
import type { ScriptInterpreter } from '../../src/clients/script-interpreter.js';
import { AppError } from '../../src/errors/app-error.js';
import {
  createFileProjectRepository,
  type ProjectRepository,
} from '../../src/repositories/project.repository.js';
import {
  createProjectService,
  INTERPRETATION_FAILED_MESSAGE,
  NO_TAKES_MESSAGE,
  type ProjectService,
} from '../../src/services/project.service.js';

const FIXED_ID = '11111111-1111-4111-8111-111111111111';

describe('createProjectService', () => {
  let dataDir: string;
  let repository: ProjectRepository;
  let interpreter: ScriptInterpreter;
  let service: ProjectService;

  function buildService(scriptInterpreter: ScriptInterpreter): ProjectService {
    return createProjectService({
      projectRepository: repository,
      scriptInterpreter,
      now: () => new Date('2026-11-06T12:00:00.000Z'),
      createId: () => FIXED_ID,
    });
  }

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'service-'));
    repository = createFileProjectRepository(dataDir);
    interpreter = createFakeScriptInterpreter();
    service = buildService(interpreter);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('cria o projeto com os takes interpretados e numerados', async () => {
    const view = await service.createFromScript('  roteiro  ');
    expect(view).toMatchObject({
      id: FIXED_ID,
      createdAt: '2026-11-06T12:00:00.000Z',
      scriptText: 'roteiro',
      interpretationError: null,
      takeErrors: [],
    });
    expect(view.takes.map((t) => [t.number, t.name])).toEqual([
      [1, 'Chegada'],
      [2, 'Série pesada'],
    ]);
  });

  it('salva o projeto no repository', async () => {
    await service.createFromScript('roteiro');
    expect(await repository.findById(FIXED_ID)).not.toBeNull();
  });

  it('não chama o interpretador quando o texto é inválido', async () => {
    const interpret = vi.spyOn(interpreter, 'interpret');
    await expect(service.createFromScript('   ')).rejects.toThrow(
      new AppError(400, 'O roteiro está vazio.'),
    );
    expect(interpret).not.toHaveBeenCalled();
  });

  it('cria o projeto sem takes e com aviso quando nada é encontrado', async () => {
    const view = await service.createFromScript('[sem-takes] roteiro');
    expect(view).toMatchObject({ takes: [], interpretationError: NO_TAKES_MESSAGE });
  });

  it('cria o projeto sem takes e com aviso quando a interpretação falha', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await service.createFromScript('[erro-ia] roteiro');
    expect(view).toMatchObject({ takes: [], interpretationError: INTERPRETATION_FAILED_MESSAGE });
    expect(logError).toHaveBeenCalled();
  });

  it('não esconde erros inesperados do interpretador', async () => {
    const broken: ScriptInterpreter = {
      interpret: async () => {
        throw new Error('bug');
      },
    };
    await expect(buildService(broken).createFromScript('roteiro')).rejects.toThrow('bug');
  });

  it('salva takes com regra quebrada e devolve os erros', async () => {
    const invalid: ScriptInterpreter = {
      interpret: async () => [{ ...FAKE_TAKES[0]!, minSeconds: 6, maxSeconds: 4 }],
    };
    const view = await buildService(invalid).createFromScript('roteiro');
    expect(view.takeErrors).toEqual([
      {
        takeNumber: 1,
        field: 'maxSeconds',
        message: 'A duração máxima não pode ser menor que a mínima.',
      },
    ]);
  });

  it('getById devolve o projeto salvo', async () => {
    await service.createFromScript('roteiro');
    const view = await service.getById(FIXED_ID);
    expect(view.id).toBe(FIXED_ID);
    expect(view.takes).toHaveLength(2);
  });

  it('getById lança 404 para projeto que não existe', async () => {
    await expect(service.getById(crypto.randomUUID())).rejects.toThrow(
      new AppError(404, 'Projeto não encontrado.'),
    );
  });

  it('updateTakes renumera, salva e limpa o aviso de interpretação', async () => {
    await service.createFromScript('[sem-takes] roteiro');
    const view = await service.updateTakes(FIXED_ID, [FAKE_TAKES[1]!]);
    expect(view).toMatchObject({
      interpretationError: null,
      takes: [{ number: 1, name: 'Série pesada' }],
    });
    expect((await repository.findById(FIXED_ID))?.takes).toHaveLength(1);
  });

  it('updateTakes aceita lista vazia', async () => {
    await service.createFromScript('roteiro');
    const view = await service.updateTakes(FIXED_ID, []);
    expect(view.takes).toEqual([]);
    expect((await repository.findById(FIXED_ID))?.takes).toEqual([]);
  });

  it('updateTakes lança 404 para projeto que não existe', async () => {
    await expect(service.updateTakes(crypto.randomUUID(), [])).rejects.toThrow(
      new AppError(404, 'Projeto não encontrado.'),
    );
  });
});
