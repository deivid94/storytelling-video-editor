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
import { FFPROBE_NOT_FOUND_MESSAGE } from '../../src/clients/ffprobe-video-prober.js';
import { VideoProbeError, type VideoProber } from '../../src/clients/video-prober.js';
import { AppError } from '../../src/errors/app-error.js';
import {
  createClipFolderRepository,
  FOLDER_NOT_FOUND_MESSAGE,
} from '../../src/repositories/clip-folder.repository.js';
import { UNSUPPORTED_EXTENSION_REASON } from '../../src/services/clip-names.js';
import type { VideoInfo } from '../../src/types/clip.js';
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
  let clipsDir: string;
  let probe: ReturnType<typeof vi.fn<(filePath: string) => Promise<VideoInfo>>>;

  const VIDEO: VideoInfo = {
    durationSeconds: 10,
    width: 1080,
    height: 1920,
    fps: 30,
    lensType: null,
  };

  function buildService(scriptInterpreter: ScriptInterpreter): ProjectService {
    const videoProber: VideoProber = { probe };
    return createProjectService({
      projectRepository: repository,
      scriptInterpreter,
      clipFolderRepository: createClipFolderRepository(),
      videoProber,
      now: () => new Date('2026-11-06T12:00:00.000Z'),
      createId: () => FIXED_ID,
    });
  }

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'service-'));
    clipsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clips-'));
    probe = vi.fn(async () => VIDEO);
    repository = createFileProjectRepository(dataDir);
    interpreter = createFakeScriptInterpreter();
    service = buildService(interpreter);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(clipsDir, { recursive: true, force: true });
  });

  async function touch(...names: string[]): Promise<void> {
    for (const name of names) await fs.writeFile(path.join(clipsDir, name), '');
  }

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

  describe('scanClips', () => {
    beforeEach(async () => {
      await service.createFromScript('roteiro');
    });

    it('mapeia os clipes aos takes', async () => {
      await touch('take1.mov', 'take2a.mp4', 'notas.txt');
      const view = await service.scanClips(FIXED_ID, clipsDir);
      expect(view.clipMapping?.takes[0]?.clips[0]?.fileName).toBe('take1.mov');
      expect(view.clipMapping?.ignoredFiles).toEqual([
        { fileName: 'notas.txt', reason: UNSUPPORTED_EXTENSION_REASON },
      ]);
      expect(view).not.toHaveProperty('clipScan');
      expect((await repository.findById(FIXED_ID))?.clipScan?.scannedAt).toBe(
        '2026-11-06T12:00:00.000Z',
      );
    });

    it('mantém os takes salvos enquanto a pasta era lida', async () => {
      await touch('take1.mov');
      const newTakes = FAKE_TAKES.slice(0, 1).map((t) => ({ ...t, name: 'Editado no meio' }));
      probe.mockImplementationOnce(async () => {
        await service.updateTakes(FIXED_ID, newTakes);
        return VIDEO;
      });
      await service.scanClips(FIXED_ID, clipsDir);
      const saved = await repository.findById(FIXED_ID);
      expect(saved?.takes.map((t) => t.name)).toEqual(['Editado no meio']);
      expect(saved?.clipScan?.clips).toHaveLength(1);
    });

    it('só lê com o ffprobe os arquivos take', async () => {
      await touch('take1.mov', 'A001_11051828_C019.mov', '._take1.mov');
      await service.scanClips(FIXED_ID, clipsDir);
      expect(probe).toHaveBeenCalledTimes(1);
      expect(probe).toHaveBeenCalledWith(path.join(clipsDir, 'take1.mov'));
    });

    it('arquivo ilegível não interrompe a leitura', async () => {
      await touch('take1.mov', 'take2.mov');
      probe.mockImplementation(async (filePath: string) => {
        if (path.basename(filePath) === 'take1.mov') throw new VideoProbeError('x');
        return VIDEO;
      });
      await service.scanClips(FIXED_ID, clipsDir);
      const clips = (await repository.findById(FIXED_ID))?.clipScan?.clips ?? [];
      expect(clips.find((c) => c.fileName === 'take1.mov')).toMatchObject({
        video: null,
        readError: 'x',
      });
      expect(clips.find((c) => c.fileName === 'take2.mov')).toMatchObject({
        video: VIDEO,
        readError: null,
      });
    });

    it('erro que não é VideoProbeError sobe e não salva a leitura', async () => {
      await touch('take1.mov');
      const error = new AppError(500, FFPROBE_NOT_FOUND_MESSAGE);
      probe.mockRejectedValue(error);
      await expect(service.scanClips(FIXED_ID, clipsDir)).rejects.toBe(error);
      expect((await repository.findById(FIXED_ID))?.clipScan).toBeNull();
    });

    it('aceita caminho com aspas', async () => {
      await touch('take1.mov');
      const view = await service.scanClips(FIXED_ID, `"${clipsDir}"`);
      expect(view.clipMapping?.folder).toBe(clipsDir);
    });

    it('lança 404 para projeto inexistente', async () => {
      await expect(service.scanClips(crypto.randomUUID(), clipsDir)).rejects.toThrow(
        new AppError(404, 'Projeto não encontrado.'),
      );
    });

    it('lança 400 para pasta inexistente', async () => {
      await expect(service.scanClips(FIXED_ID, path.join(clipsDir, 'nao-existe'))).rejects.toThrow(
        new AppError(400, FOLDER_NOT_FOUND_MESSAGE),
      );
    });

    it('ler de novo substitui a leitura anterior', async () => {
      await touch('take1.mov', 'take2a.mp4');
      await service.scanClips(FIXED_ID, clipsDir);
      await fs.rm(path.join(clipsDir, 'take2a.mp4'));
      const view = await service.scanClips(FIXED_ID, clipsDir);
      const saved = await repository.findById(FIXED_ID);
      expect(saved?.clipScan?.clips.map((c) => c.fileName)).toEqual(['take1.mov']);
      expect(JSON.stringify(view.clipMapping)).not.toContain('take2a.mp4');
    });

    it('editar os takes recalcula o mapeamento sem ler de novo', async () => {
      await touch('take1.mov', 'take2a.mp4');
      await service.scanClips(FIXED_ID, clipsDir);
      probe.mockClear();
      const view = await service.updateTakes(FIXED_ID, FAKE_TAKES.slice(0, 1));
      expect(view.clipMapping?.orphanClips.map((c) => c.fileName)).toEqual(['take2a.mp4']);
      expect(probe).not.toHaveBeenCalled();
    });
  });

  it('projeto novo vem com clipMapping null', async () => {
    const view = await service.createFromScript('roteiro');
    expect(view.clipMapping).toBeNull();
    expect(view).not.toHaveProperty('clipScan');
  });
});
