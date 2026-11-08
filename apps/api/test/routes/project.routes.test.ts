import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  createFakeScriptInterpreter,
  FAKE_TAKES,
} from '../../src/clients/fake-script-interpreter.js';
import { FFPROBE_NOT_FOUND_MESSAGE } from '../../src/clients/ffprobe-video-prober.js';
import { AppError } from '../../src/errors/app-error.js';
import {
  createClipFolderRepository,
  FOLDER_NOT_FOUND_MESSAGE,
} from '../../src/repositories/clip-folder.repository.js';
import { createFileProjectRepository } from '../../src/repositories/project.repository.js';
import { createProjectService, type ProjectService } from '../../src/services/project.service.js';

let dataDir: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'api-routes-'));
  app = createApp({
    projectService: createProjectService({
      projectRepository: createFileProjectRepository(dataDir),
      scriptInterpreter: createFakeScriptInterpreter(),
      clipFolderRepository: createClipFolderRepository(),
      videoProber: { probe: () => Promise.reject(new Error('não usado')) },
      now: () => new Date('2026-01-01T00:00:00Z'),
      createId: () => randomUUID(),
    }),
  });
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

async function createProject() {
  const response = await request(app).post('/api/projects').send({ scriptText: 'roteiro' });
  return response.body as { id: string };
}

describe('POST /api/projects', () => {
  it('cria o projeto e responde 201', async () => {
    const response = await request(app).post('/api/projects').send({ scriptText: 'roteiro' });

    expect(response.status).toBe(201);
    expect(response.body.takes).toHaveLength(2);
  });

  it('responde 400 com a mensagem do service para roteiro vazio', async () => {
    const response = await request(app).post('/api/projects').send({ scriptText: '  ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'O roteiro está vazio.' });
  });

  it.each([[{}], [{ scriptText: 42 }], [{ scriptText: null }]])(
    'responde 400 para corpo %j',
    async (body) => {
      const response = await request(app).post('/api/projects').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Dados inválidos.');
      expect(response.body.details[0].path).toBe('scriptText');
    },
  );

  it('responde 400 para JSON malformado', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send('{ quebrado');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'JSON inválido.' });
  });

  it('responde 413 para corpo acima de 200kb', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({ scriptText: 'a'.repeat(210_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Requisição grande demais.' });
  });
});

describe('GET /api/projects/:id', () => {
  it('devolve o projeto criado', async () => {
    const created = await createProject();

    const response = await request(app).get(`/api/projects/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.id, scriptText: 'roteiro', takeErrors: [] });
    expect(response.body.takes).toHaveLength(2);
  });

  it.each(['nao-existe', randomUUID(), '..%2F..%2Fetc'])('responde 404 para %s', async (id) => {
    const response = await request(app).get(`/api/projects/${id}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Projeto não encontrado.' });
  });
});

describe('PUT /api/projects/:id/takes', () => {
  it('salva os takes e devolve os erros de regra', async () => {
    const created = await createProject();
    const invalidTake = { ...FAKE_TAKES[0], minSeconds: 5, maxSeconds: 2 };

    const response = await request(app)
      .put(`/api/projects/${created.id}/takes`)
      .send({ takes: [invalidTake] });

    expect(response.status).toBe(200);
    expect(response.body.takes).toHaveLength(1);
    expect(response.body.takeErrors.length).toBeGreaterThan(0);

    const reloaded = await request(app).get(`/api/projects/${created.id}`);
    expect(reloaded.body.takes).toHaveLength(1);
  });

  it('responde 400 para mais de 50 takes', async () => {
    const created = await createProject();
    const takes = Array.from({ length: 51 }, () => FAKE_TAKES[0]);

    const response = await request(app).put(`/api/projects/${created.id}/takes`).send({ takes });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Dados inválidos.');
    expect(response.body.details[0].path).toBe('takes');
  });

  it('responde 400 para take sem campo obrigatório', async () => {
    const created = await createProject();
    const takeWithoutName: Partial<(typeof FAKE_TAKES)[number]> = { ...FAKE_TAKES[0] };
    delete takeWithoutName.name;

    const response = await request(app)
      .put(`/api/projects/${created.id}/takes`)
      .send({ takes: [takeWithoutName] });

    expect(response.status).toBe(400);
    expect(response.body.details[0].path).toBe('takes.0.name');
  });

  it('responde 404 para projeto que não existe', async () => {
    const response = await request(app)
      .put(`/api/projects/${randomUUID()}/takes`)
      .send({ takes: [] });

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/projects/:id/clips-folder', () => {
  function appWithScanClips(scanClips: ProjectService['scanClips']) {
    const notUsed = () => Promise.reject(new Error('não usado'));
    return createApp({
      projectService: {
        createFromScript: notUsed,
        getById: notUsed,
        updateTakes: notUsed,
        scanClips,
      },
    });
  }

  it('chama scanClips com id e pasta e responde 200 com o view', async () => {
    const view = { id: 'p1', clipMapping: { entries: [], warnings: [] } };
    const scanClips = vi.fn().mockResolvedValue(view);

    const response = await request(appWithScanClips(scanClips))
      .put('/api/projects/p1/clips-folder')
      .send({ folder: '/videos/clipes' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    expect(scanClips).toHaveBeenCalledWith('p1', '/videos/clipes');
  });

  it('responde 400 sem o campo folder', async () => {
    const scanClips = vi.fn();

    const response = await request(appWithScanClips(scanClips))
      .put('/api/projects/p1/clips-folder')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Dados inválidos.');
    expect(response.body.details[0].path).toBe('folder');
    expect(scanClips).not.toHaveBeenCalled();
  });

  it('responde 400 para caminho com mais de 1000 caracteres', async () => {
    const scanClips = vi.fn();

    const response = await request(appWithScanClips(scanClips))
      .put('/api/projects/p1/clips-folder')
      .send({ folder: 'x'.repeat(1001) });

    expect(response.status).toBe(400);
    expect(scanClips).not.toHaveBeenCalled();
  });

  it('repassa o erro 400 de pasta inexistente', async () => {
    const scanClips = vi.fn().mockRejectedValue(new AppError(400, FOLDER_NOT_FOUND_MESSAGE));

    const response = await request(appWithScanClips(scanClips))
      .put('/api/projects/p1/clips-folder')
      .send({ folder: 'nada' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: FOLDER_NOT_FOUND_MESSAGE });
  });

  it('repassa o erro 500 de ffprobe não encontrado', async () => {
    const scanClips = vi.fn().mockRejectedValue(new AppError(500, FFPROBE_NOT_FOUND_MESSAGE));

    const response = await request(appWithScanClips(scanClips))
      .put('/api/projects/p1/clips-folder')
      .send({ folder: 'x' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: FFPROBE_NOT_FOUND_MESSAGE });
  });
});

describe('erros inesperados', () => {
  it('responde 500 sem vazar detalhes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingService: ProjectService = {
      createFromScript: () => Promise.reject(new Error('segredo')),
      getById: () => Promise.reject(new Error('segredo')),
      updateTakes: () => Promise.reject(new Error('segredo')),
      scanClips: () => Promise.reject(new Error('segredo')),
    };

    const response = await request(createApp({ projectService: failingService }))
      .post('/api/projects')
      .send({ scriptText: 'roteiro' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Erro interno do servidor' });
    errorSpy.mockRestore();
  });
});
